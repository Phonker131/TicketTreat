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


if __name__ == "__main__":
    unittest.main()
