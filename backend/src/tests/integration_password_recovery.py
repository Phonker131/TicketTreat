"""Verified password recovery: unverified-email account takeover regression.

Against disposable CI PostgreSQL only, with mocked outbound email.
An email-only recovery MUST NOT confer ownership over another person's
historic unverified account, including tickets and stored payment history.
"""
import os
import secrets
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password


class PasswordRecoveryIntegrationTests(unittest.TestCase):
    @staticmethod
    def create_account(*, email_verified: bool):
        email=f"recovery-{secrets.token_hex(10)}@example.invalid"
        old_password="prior-password-2026-test"
        with SessionLocal() as db:
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                first_name="Recovery",last_name="Test",email=email)
            db.add(guest);db.flush()
            account=WebAccount(email=email,first_name="Recovery",last_name="Test",
                password_hash=hash_password(old_password),
                contact_preference="email",guest_id=guest.id)
            db.add(account);db.flush()
            if email_verified:
                db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
            db.commit()
            return email, account.id, old_password

    def test_unverified_mailbox_cannot_take_over_another_account(self):
        unverified_email, unverified_id, old_pw=self.create_account(email_verified=False)
        verified_email, verified_id, verified_pw=self.create_account(email_verified=True)
        new_pw="new-password-2026-test"
        sent=[]
        with TestClient(main.app) as client:
            with patch("demo_account_recovery.configured",return_value=True),patch(
                "demo_account_recovery.send_code",
                side_effect=lambda address,purpose,code: sent.append((address,purpose,code))):
                unknown=f"not-found-{secrets.token_hex(10)}@example.invalid"
                u=client.post("/demo/auth/password/forgot",json={"email":unverified_email})
                v=client.post("/demo/auth/password/forgot",json={"email":verified_email})
                missing=client.post("/demo/auth/password/forgot",json={"email":unknown})
                self.assertEqual(u.status_code,200,u.text)
                self.assertEqual(v.status_code,200,v.text)
                self.assertEqual(missing.status_code,200,missing.text)
                self.assertEqual(u.json(),v.json())
                self.assertEqual(v.json(),missing.json())
                self.assertEqual(len(sent),1)
                self.assertEqual(sent[0][:2],(verified_email,"reset"))
                # Including an old challenge previously generated for an
                # unverified email must never reset that account's password.
                denied=client.post("/demo/auth/password/reset",json={
                    "email":unverified_email,"code":sent[0][2],
                    "new_password":new_pw,
                })
                self.assertEqual(denied.status_code,400,denied.text)
                success=client.post("/demo/auth/password/reset",json={
                    "email":verified_email,"code":sent[0][2],
                    "new_password":new_pw,
                })
                self.assertEqual(success.status_code,200,success.text)
                self.assertTrue(success.json()["sessions_revoked"])
                replay=client.post("/demo/auth/password/reset",json={
                    "email":verified_email,"code":sent[0][2],
                    "new_password":new_pw,
                })
                self.assertEqual(replay.status_code,400,replay.text)
            with SessionLocal() as db:
                self.assertIsNone(db.get(VerifiedEmail,unverified_id))
                self.assertIsNotNone(db.get(VerifiedEmail,verified_id))
            original=client.post("/demo/auth/login",json={
                "email":unverified_email,"password":old_pw,
            })
            self.assertEqual(original.status_code,200,original.text)
            incorrect=client.post("/demo/auth/login",json={
                "email":unverified_email,"password":new_pw,
            })
            self.assertEqual(incorrect.status_code,401,incorrect.text)
            verified_new=client.post("/demo/auth/login",json={
                "email":verified_email,"password":new_pw,
            })
            self.assertEqual(verified_new.status_code,200,verified_new.text)
            verified_old=client.post("/demo/auth/login",json={
                "email":verified_email,"password":verified_pw,
            })
            self.assertEqual(verified_old.status_code,401,verified_old.text)


if __name__=="__main__":
    unittest.main()
