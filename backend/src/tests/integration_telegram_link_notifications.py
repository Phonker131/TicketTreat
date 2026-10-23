"""Linking an authenticated website profile to Telegram delivers existing QR ticket links.

Test never contacts Telegram; the delivery function is mocked and the database
is isolated to the disposable PostgreSQL CI service.
"""
import hashlib
import hmac
import json
import os
import secrets
import time
import unittest
from datetime import datetime,timedelta,timezone
from decimal import Decimal
from unittest.mock import patch
from urllib.parse import urlencode
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount,WebSession,token_hash
from demo_account_recovery import VerifiedEmail,now
from demo_auth_security import hash_password
from demo_telegram import DemoTelegramIdentity


def signed(tid):
    token="ci-only-tickettreat-telegram-bot-token"
    data={"auth_date":str(int(time.time())),
          "user":json.dumps({"id":tid,"first_name":"TgMember"},separators=(",",":"))}
    check="\n".join(f"{k}={v}" for k,v in sorted(data.items()))
    key=hmac.new(b"WebAppData",token.encode(),hashlib.sha256).digest()
    data["hash"]=hmac.new(key,check.encode(),hashlib.sha256).hexdigest()
    return urlencode(data)


class LinkExistingTicketTests(unittest.TestCase):
    def test_sends_link_for_prior_website_ticket_only_after_verified_link(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        ticket_name="Old website booking"
        web_token=secrets.token_urlsafe(36)
        with SessionLocal() as db:
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                                 first_name="Website Member",
                                 email=f"linked-{telegram_id}@example.invalid")
            event=main.Event(title=ticket_name,price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                max_participants=10,currency="CZK")
            db.add_all([guest,event]);db.flush()
            account=WebAccount(email=guest.email,first_name="Website Member",
                last_name="Example",guest_id=guest.id,
                password_hash=hash_password("strong-test-password-2026"),
                contact_preference="email")
            db.add(account);db.flush()
            db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
            db.add(WebSession(account_id=account.id,token_hash=token_hash(web_token),
                expires_at=now()+timedelta(days=4)))
            ticket=main.DemoTicket(event_id=event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK")
            db.add(ticket);db.commit()
            ticket_id=ticket.id
        with patch.dict(os.environ,{"TELEGRAM_MINIAPP_BOT_TOKEN":"ci-only-tickettreat-telegram-bot-token"}):
            with TestClient(main.app) as client:
                launch=signed(telegram_id)
                signed_in=client.post("/demo/telegram/auth",json={"init_data":launch})
                self.assertEqual(signed_in.status_code,200,signed_in.text)
                with patch("demo_telegram.send_miniapp_ticket_notice") as send:
                    response=client.post("/demo/telegram/link",
                        json={"init_data":launch},
                        headers={"Authorization":"Bearer "+web_token})
                    self.assertEqual(response.status_code,200,response.text)
                    self.assertTrue(response.json()["linked"])
                    send.assert_called_once_with(telegram_id,ticket_name,ticket_id,True,"ru")
                with SessionLocal() as db:
                    self.assertIsNotNone(db.get(DemoTelegramIdentity,telegram_id))
                    cards=main.get_user_events(telegram_id,include_web_tickets=True,db=db)
                    self.assertEqual(len(cards),1)
                    self.assertEqual(cards[0]["ticket_id"],ticket_id)


if __name__=="__main__":
    unittest.main()
