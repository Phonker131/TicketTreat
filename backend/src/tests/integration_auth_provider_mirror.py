"""Verified provider mirroring and Telegram-first canonical principal creation.

Runs only against the disposable PostgreSQL integration fixture.
"""
import os
import secrets
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing to test provider mirroring against production")

import main
from db.session import SessionLocal
from demo_accounts import AuthIdentity, WebAccount
from demo_account_recovery import VerifiedEmail, now
from demo_telegram import DemoTelegramIdentity
from demo_auth_security import hash_password
from integration_telegram_browser_link import BOT_TOKEN, signed_init_data, website_account


class VerifiedProviderMirrorTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "TELEGRAM_MINIAPP_BOT_TOKEN": BOT_TOKEN,
            "TICKETTREAT_IDENTITY_REGISTRY_MODE": "shadow",
        })
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_signed_miniapp_creates_reusable_canonical_account_and_registry_claim(self):
        telegram_id = secrets.randbelow(10**12) + 10**10
        signed = signed_init_data(telegram_id)
        with TestClient(main.app) as client:
            first = client.post("/demo/telegram/auth",json={"init_data":signed})
            self.assertEqual(first.status_code,200,first.text)
            guest_id = first.json()["guest"]["id"]
            self.assertFalse(first.json()["accounts_linked"])
            with SessionLocal() as db:
                account = db.query(WebAccount).filter(WebAccount.guest_id==guest_id).one()
                self.assertIsNone(account.email)
                claim = db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="telegram",
                    AuthIdentity.provider_subject==str(telegram_id),
                ).one()
                self.assertEqual(claim.account_id,account.id)
                account_id=account.id
            second = client.post("/demo/telegram/auth",json={"init_data":signed})
            self.assertEqual(second.status_code,200,second.text)
            self.assertEqual(second.json()["guest"]["id"],guest_id)
            with SessionLocal() as db:
                self.assertEqual(db.query(WebAccount).filter(WebAccount.guest_id==guest_id).count(),1)
                self.assertEqual(db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="telegram",
                    AuthIdentity.provider_subject==str(telegram_id),
                    AuthIdentity.account_id==account_id,
                ).count(),1)

    def test_verified_telegram_shadow_moves_only_after_explicit_two_identity_link(self):
        telegram_id = secrets.randbelow(10**12) + 10**10
        signed = signed_init_data(telegram_id)
        target_id,target_guest,bearer = website_account()
        with SessionLocal() as db:
            target = db.get(WebAccount,target_id)
            self.assertIsNotNone(db.get(VerifiedEmail,target_id))
            self.assertIsNotNone(target)
        with TestClient(main.app) as client:
            signed_first = client.post("/demo/telegram/auth",json={"init_data":signed})
            self.assertEqual(signed_first.status_code,200,signed_first.text)
            tg_guest=signed_first.json()["guest"]["id"]
            with SessionLocal() as db:
                shadow=db.query(WebAccount).filter(WebAccount.guest_id==tg_guest).one()
                self.assertNotEqual(shadow.id,target_id)
                shadow_id=shadow.id
            linked=client.post("/demo/telegram/link",json={"init_data":signed},
                               headers={"Authorization":"Bearer "+bearer})
            self.assertEqual(linked.status_code,200,linked.text)
            with SessionLocal() as db:
                row=db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="telegram",
                    AuthIdentity.provider_subject==str(telegram_id),
                ).one()
                self.assertEqual(row.account_id,target_id)
                self.assertNotEqual(row.account_id,shadow_id)
                self.assertEqual(db.get(DemoTelegramIdentity,telegram_id).guest_id,target_guest)

    def test_legacy_password_signup_never_claims_unverified_email(self):
        email="unverified-ci-"+secrets.token_hex(8)+"@example.invalid"
        with TestClient(main.app) as client:
            created=client.post("/demo/auth/signup",json={
                "email":email,"password":"safe-legacy-test-password-123",
                "first_name":"Unverified","last_name":"Test",
                "contact_preference":"email","language":"en",
            })
            self.assertEqual(created.status_code,201,created.text)
            with SessionLocal() as db:
                account=db.query(WebAccount).filter(WebAccount.email==email).one()
                self.assertIsNone(db.get(VerifiedEmail,account.id))
                self.assertIsNone(db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="email",
                    AuthIdentity.provider_subject==email,
                ).first())


if __name__=="__main__":
    unittest.main()
