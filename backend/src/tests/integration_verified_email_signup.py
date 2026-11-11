"""Password signup must prove the mailbox before reserving a verified email.

Disposable PostgreSQL only. External email delivery is mocked; the real
cryptographic OTP digest and DB row locks are deliberately exercised.
"""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Unsafe signup integration database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, AuthIdentity
from demo_account_recovery import VerifiedEmail
from demo_quick_signup import QuickSignupPending, QuickPrivacyConsent


class VerifiedPasswordSignupTests(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{
            "REQUIRE_SIGNUP_EMAIL_OTP":"true",
            "TICKETTREAT_IDENTITY_REGISTRY_MODE":"shadow",
        })
        self.env.start()
        self.email="verified-signup-ci-"+secrets.token_hex(9)+"@example.invalid"
        self.payload={
            "email":self.email,
            "password":"password-signup-ci-safe-2026!",
            "first_name":"Verified",
            "last_name":"Registrant",
            "contact_preference":"email",
            "account_role":"participant",
        }

    def tearDown(self):
        self.env.stop()

    def request_code(self,client):
        with patch("demo_email.configured",return_value=True), \
             patch("demo_quick_signup.send_code") as delivery, \
             patch("demo_quick_signup.secrets.randbelow",return_value=12345678):
            result=client.post("/demo/auth/quick/request",json={
                "email":self.email,"first_name":"Verified",
                "privacy_accepted":True,
                "privacy_version":"2026-10",
            })
        self.assertEqual(result.status_code,200,result.text)
        delivery.assert_called_once()
        self.assertEqual(delivery.call_args.args[2],"12345678")

    def test_otp_is_required_and_mailbox_remains_unreserved_until_confirmed(self):
        with TestClient(main.app) as client:
            no_code=client.post("/demo/auth/signup",json=self.payload)
            self.assertEqual(no_code.status_code,409,no_code.text)
            with SessionLocal() as db:
                self.assertIsNone(db.query(WebAccount).filter(WebAccount.email==self.email).first())
            self.request_code(client)
            wrong=client.post("/demo/auth/signup",json={**self.payload,"email_code":"00000000"})
            self.assertEqual(wrong.status_code,400,wrong.text)
            success=client.post("/demo/auth/signup",json={**self.payload,"email_code":"12345678"})
            self.assertEqual(success.status_code,201,success.text)
            self.assertTrue(success.json()["profile"]["email_verified"])
            with SessionLocal() as db:
                account=db.query(WebAccount).filter(WebAccount.email==self.email).one()
                self.assertIsNotNone(db.get(VerifiedEmail,account.id))
                consent=db.get(QuickPrivacyConsent,account.id)
                self.assertIsNotNone(consent)
                self.assertEqual(consent.version,"2026-10")
                self.assertIsNone(db.get(QuickSignupPending,self.email))
                self.assertEqual(db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="email",
                    AuthIdentity.provider_subject==self.email,
                    AuthIdentity.account_id==account.id,
                ).count(),1)
            reuse=client.post("/demo/auth/signup",json={**self.payload,"email_code":"12345678"})
            self.assertIn(reuse.status_code,(400,409),reuse.text)
            with SessionLocal() as db:
                self.assertEqual(db.query(WebAccount).filter(
                    WebAccount.email==self.email).count(),1)

    def test_concurrent_password_signups_cannot_consume_same_otp_twice(self):
        with TestClient(main.app) as client:
            self.request_code(client)
            def send(_):
                return client.post("/demo/auth/signup",json={
                    **self.payload,"email_code":"12345678",
                })
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses=list(pool.map(send,range(2)))
            self.assertEqual(sum(x.status_code==201 for x in responses),1,
                             [(x.status_code,x.text) for x in responses])
            with SessionLocal() as db:
                self.assertEqual(db.query(WebAccount).filter(
                    WebAccount.email==self.email).count(),1)
                self.assertIsNone(db.get(QuickSignupPending,self.email))


if __name__=="__main__":
    unittest.main()
