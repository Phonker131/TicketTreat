"""End-to-end browser ↔ Telegram pairing on the disposable CI PostgreSQL database."""
import hashlib
import hmac
import json
import os
import secrets
import time
import unittest
from datetime import timedelta
from urllib.parse import urlencode

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Never run Telegram pairing integration against live user data")

BOT_TOKEN = "ci-telegram-link-only-not-real"

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_auth_security import hash_password
from demo_account_recovery import VerifiedEmail, now
from demo_telegram import DemoTelegramIdentity


def signed_init_data(telegram_id):
    values = {
        "auth_date": str(int(time.time())),
        "user": json.dumps({"id": telegram_id, "first_name": "Verified Telegram"},
                           separators=(",", ":")),
    }
    check = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(values)


def website_account():
    with SessionLocal() as db:
        guest = main.DemoGuest(access_token=secrets.token_urlsafe(32), first_name="Web",
                               email=f"link-{secrets.token_hex(12)}@example.invalid")
        db.add(guest); db.flush()
        account = WebAccount(guest_id=guest.id, email=guest.email,
                             first_name="Web", last_name="Person",
                             password_hash=hash_password("not-a-real-password-1234"),
                             contact_preference="email")
        db.add(account); db.flush()
        db.add(VerifiedEmail(account_id=account.id, verified_at=now()))
        bearer = secrets.token_urlsafe(36)
        db.add(WebSession(account_id=account.id, token_hash=token_hash(bearer),
                          expires_at=now() + timedelta(days=2)))
        db.commit()
        return account.id, guest.id, bearer


class TelegramBrowserLinkTests(unittest.TestCase):
    def setUp(self):
        self.previous_token=os.environ.get("TELEGRAM_MINIAPP_BOT_TOKEN")
        os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"]=BOT_TOKEN

    def tearDown(self):
        if self.previous_token is None:
            os.environ.pop("TELEGRAM_MINIAPP_BOT_TOKEN",None)
        else:
            os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"]=self.previous_token

    def test_browser_pairs_legacy_tg_identity_and_consumes_code_once(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        signed=signed_init_data(telegram_id)
        account_id, web_id, bearer=website_account()
        header={"Authorization": "Bearer "+bearer}
        with TestClient(main.app) as client:
            # Telegram-only users already signed in through Mini App do not
            # magically own a website account, even if names match.
            auth=client.post("/demo/telegram/auth",json={"init_data":signed})
            self.assertEqual(auth.status_code,200,auth.text)
            self.assertFalse(auth.json()["accounts_linked"])
            with SessionLocal() as db:
                old=db.get(DemoTelegramIdentity,telegram_id).guest_id
                self.assertNotEqual(old,web_id)

            start=client.post("/demo/telegram/link/start",headers=header)
            self.assertEqual(start.status_code,200,start.text)
            code=start.json()["challenge"]
            self.assertIn("t.me/TicketTreatBot?start=link_",start.json()["bot_link"])
            self.assertNotIn(str(telegram_id),start.json()["bot_link"])
            pending=client.get("/demo/telegram/link/status",params={"challenge":code},headers=header)
            self.assertEqual(pending.json()["status"],"pending")

            invalid=client.post("/demo/telegram/link/claim",json={
                "challenge":code,"init_data":"forged-data-without-hmac-signature"})
            self.assertEqual(invalid.status_code,401)
            self.assertEqual(client.get("/demo/telegram/link/status",
                params={"challenge":code},headers=header).json()["status"],"pending")

            claimed=client.post("/demo/telegram/link/claim",json={
                "challenge":code,"init_data":signed})
            self.assertEqual(claimed.status_code,200,claimed.text)
            self.assertTrue(claimed.json()["linked"])
            self.assertEqual(client.get("/demo/telegram/link/status",
                params={"challenge":code},headers=header).json()["status"],"linked")
            self.assertEqual(client.post("/demo/telegram/link/claim",json={
                "challenge":code,"init_data":signed}).status_code,409)
            with SessionLocal() as db:
                self.assertEqual(db.get(DemoTelegramIdentity,telegram_id).guest_id,web_id)
                self.assertEqual(db.get(main.DemoGuest,web_id).telegram_id,telegram_id)
                self.assertIsNone(db.get(main.DemoGuest,old).telegram_id)

    def test_duplicate_free_passes_are_reconciled_without_double_booking(self):
        from datetime import datetime, timezone
        from decimal import Decimal
        telegram_id=secrets.randbelow(10**12)+10**10
        signed=signed_init_data(telegram_id)
        _,web_id,bearer=website_account()
        with TestClient(main.app) as client:
            auth=client.post("/demo/telegram/auth",json={"init_data":signed})
            self.assertEqual(auth.status_code,200,auth.text)
            with SessionLocal() as db:
                old_id=db.get(DemoTelegramIdentity,telegram_id).guest_id
                event=main.Event(
                    title="Duplicate CI free tickets", price=Decimal("0"),
                    starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=3),
                    max_participants=20,currency="CZK")
                db.add(event);db.flush()
                old_ticket=main.DemoTicket(
                    event_id=event.id,guest_id=old_id,qr_token=secrets.token_urlsafe(32),
                    ticket_status="active",payment_status="not_required",
                    payment_provider="free",payment_amount="0",currency="CZK")
                website_ticket=main.DemoTicket(
                    event_id=event.id,guest_id=web_id,qr_token=secrets.token_urlsafe(32),
                    ticket_status="active",payment_status="not_required",
                    payment_provider="free",payment_amount="0",currency="CZK")
                db.add_all([old_ticket,website_ticket]);db.flush()
                old_ticket_id,website_id=old_ticket.id,website_ticket.id
                db.commit()
            start=client.post("/demo/telegram/link/start",
                headers={"Authorization":"Bearer "+bearer})
            self.assertEqual(start.status_code,200,start.text)
            joined=client.post("/demo/telegram/link/claim",json={
                "challenge":start.json()["challenge"],"init_data":signed})
            self.assertEqual(joined.status_code,200,joined.text)
            self.assertEqual(joined.json()["deduplicated_free_tickets"],1)
            with SessionLocal() as db:
                self.assertEqual(db.get(main.DemoTicket,website_id).ticket_status,"active")
                self.assertEqual(db.get(main.DemoTicket,old_ticket_id).ticket_status,"cancelled")
                active=db.query(main.DemoTicket).filter(
                    main.DemoTicket.event_id==event.id,
                    main.DemoTicket.ticket_status=="active").count()
                self.assertEqual(active,1)

    def test_one_code_is_bound_to_website_and_expires(self):
        owner,owner_guest,bearer=website_account()
        other,other_guest,other_bearer=website_account()
        with TestClient(main.app) as client:
            start=client.post("/demo/telegram/link/start",
                headers={"Authorization":"Bearer "+bearer})
            self.assertEqual(start.status_code,200,start.text)
            code=start.json()["challenge"]
            stolen=client.get("/demo/telegram/link/status",
                params={"challenge":code},
                headers={"Authorization":"Bearer "+other_bearer})
            self.assertEqual(stolen.status_code,404)
            with SessionLocal() as db:
                from demo_telegram import TelegramLinkChallenge, _link_hash
                db.query(TelegramLinkChallenge).filter(
                    TelegramLinkChallenge.code_hash==_link_hash(code)).update({
                        "expires_at": now()-timedelta(minutes=1)
                    })
                db.commit()
            expired=client.post("/demo/telegram/link/claim",json={
                "challenge":code,
                "init_data":signed_init_data(secrets.randbelow(10**12)+10**10)})
            self.assertEqual(expired.status_code,410,expired.text)

if __name__=="__main__":
    unittest.main()
