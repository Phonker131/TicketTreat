"""Verified website-to-Telegram account linking against disposable PostgreSQL."""
import hashlib
import hmac
import json
import os
import secrets
import time
import unittest
from urllib.parse import urlencode

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Integration tests must use disposable tickettreat_ci DB")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password
from demo_telegram import DemoTelegramIdentity

BOT_TOKEN = "ci-only-bot-token-not-production"
os.environ["TELEGRAM_MINIAPP_BOT_TOKEN"] = BOT_TOKEN


def initdata(tid: int):
    payload = {"auth_date": str(int(time.time())),
               "user": json.dumps({"id": tid, "first_name": "TgName"}, separators=(",", ":"))}
    check = "\n".join(f"{key}={value}" for key, value in sorted(payload.items()))
    key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    payload["hash"] = hmac.new(key, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(payload)


class AccountLinkTests(unittest.TestCase):
    def test_link_requires_two_identities_and_preserves_profile(self):
        with TestClient(main.app) as client:
            telegram_id = secrets.randbelow(10**12)+10**10
            launch = initdata(telegram_id)
            response = client.post("/demo/telegram/auth", json={"init_data": launch})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertFalse(response.json()["accounts_linked"])
            with SessionLocal() as db:
                guest = main.DemoGuest(access_token=secrets.token_urlsafe(32),
                                       first_name="Website", last_name="Member",
                                       email=f"ci-{telegram_id}@example.invalid")
                db.add(guest)
                db.flush()
                account = WebAccount(email=guest.email, password_hash=hash_password("dummy-safe-password-1234"),
                                     first_name="Website", last_name="Member", guest_id=guest.id,
                                     contact_preference="email")
                db.add(account)
                db.flush()
                db.add(VerifiedEmail(account_id=account.id, verified_at=now()))
                raw_token=secrets.token_urlsafe(36)
                db.add(WebSession(account_id=account.id, token_hash=token_hash(raw_token),
                                  expires_at=now().replace(year=now().year+1)))
                db.commit()
                web_guest_id = guest.id
            # A self-declared anonymous guest must never book in production.
            anonymous_token=secrets.token_urlsafe(32)
            with SessionLocal() as db:
                db.add(main.DemoGuest(access_token=anonymous_token,first_name="Anonymous"))
                db.commit()
            blocked=client.post("/demo/events/999999/checkout",json={
                "guest_token":anonymous_token,"language":"en"
            })
            self.assertEqual(blocked.status_code,401,blocked.text)
            linked = client.post("/demo/telegram/link", json={"init_data": launch},
                                 headers={"Authorization": "Bearer "+raw_token})
            self.assertEqual(linked.status_code, 200, linked.text)
            self.assertTrue(linked.json()["linked"])
            with SessionLocal() as db:
                identity = db.get(DemoTelegramIdentity, telegram_id)
                self.assertEqual(identity.guest_id, web_guest_id)
            again = client.post("/demo/telegram/auth", json={"init_data": launch})
            self.assertEqual(again.status_code, 200, again.text)
            self.assertTrue(again.json()["accounts_linked"])
            self.assertEqual(again.json()["guest"]["first_name"], "Website")
            # Free tickets must work with APP_ENV=production while
            # simulated paid checkout is disabled.
            from datetime import datetime, timedelta, timezone
            from decimal import Decimal
            with SessionLocal() as db:
                event = main.Event(title="CI free event",price=Decimal("0"),
                    starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                    max_participants=4,currency="CZK")
                db.add(event);db.commit();db.refresh(event)
                event_id=event.id
            self.assertEqual(again.json()["guest"]["access_token"],"")
            # Legacy route tests use a token obtained internally from fixture
            # data, never from a production API response.
            with SessionLocal() as db:
                guest_token=db.get(main.DemoGuest,web_guest_id).access_token
            ticket=client.post(f"/demo/events/{event_id}/checkout",json={
                "guest_token":guest_token,"language":"en"
            },headers={"X-Telegram-Init-Data":launch})
            self.assertEqual(ticket.status_code,200,ticket.text)
            self.assertEqual(ticket.json()["ticket"]["payment_status"],"not_required")
            self.assertFalse(ticket.json()["demo_payment"])
            again_ticket=client.post(f"/demo/events/{event_id}/checkout",json={
                "guest_token":guest_token,"language":"en"
            },headers={"X-Telegram-Init-Data":launch})
            self.assertEqual(again_ticket.json()["status"],"already_registered")
            # A leaked guest token alone is insufficient for ticket access.
            leaked=client.get(f"/demo/guests/{guest_token}/tickets")
            self.assertEqual(leaked.status_code,401,leaked.text)
            wrong_guest=client.get(f"/demo/guests/{anonymous_token}/tickets",
                headers={"X-Telegram-Init-Data":launch})
            self.assertEqual(wrong_guest.status_code,403,wrong_guest.text)
            mine=client.get(f"/demo/guests/{guest_token}/tickets",
                headers={"Authorization":"Bearer "+raw_token})
            self.assertEqual(mine.status_code,200,mine.text)
            self.assertGreaterEqual(len(mine.json()),1)
            cancelled=client.delete(f"/demo/guests/{guest_token}/tickets/{ticket.json()['ticket']['id']}",
                headers={"Authorization":"Bearer "+raw_token})
            self.assertEqual(cancelled.status_code,200,cancelled.text)
            # Erasure requests require account authentication and password
            # confirmation, and may be withdrawn without corrupting tickets.
            headers={"Authorization":"Bearer "+raw_token}
            bad=client.post("/demo/auth/privacy-request",
                headers=headers,json={"current_password":"incorrect"})
            self.assertEqual(bad.status_code,403,bad.text)
            request=client.post("/demo/auth/privacy-request",headers=headers,
                json={"current_password":"dummy-safe-password-1234"})
            self.assertEqual(request.status_code,202,request.text)
            pending=client.get("/demo/auth/privacy-request",headers=headers)
            self.assertEqual(pending.json()["status"],"pending")
            withdrawn=client.delete("/demo/auth/privacy-request",headers=headers)
            self.assertEqual(withdrawn.json()["status"],"withdrawn")


if __name__ == "__main__":
    unittest.main()
