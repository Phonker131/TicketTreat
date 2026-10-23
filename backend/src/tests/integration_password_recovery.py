"""Regression: legitimate password recovery verifies a previously unverified mailbox.

Uses disposable CI PostgreSQL and mocked transport; no email is actually sent.
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
from demo_account_recovery import VerifiedEmail
from demo_auth_security import hash_password


class PasswordRecoveryIntegrationTests(unittest.TestCase):
    def test_unverified_email_can_reset_and_is_verified_once_code_is_proved(self):
        email=f"recovery-{secrets.token_hex(10)}@example.invalid"
        old_password="prior-password-2026-test"
        new_password="new-password-2026-test"
        with SessionLocal() as db:
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                first_name="Recovery",last_name="Test",email=email)
            db.add(guest);db.flush()
            account=WebAccount(email=email,first_name="Recovery",last_name="Test",
                password_hash=hash_password(old_password),
                contact_preference="email",guest_id=guest.id)
            db.add(account);db.commit()
            account_id=account.id
            self.assertIsNone(db.get(VerifiedEmail,account_id))

        sent=[]
        with TestClient(main.app) as client:
            with patch("demo_account_recovery.configured",return_value=True),patch(
                "demo_account_recovery.send_code",
                side_effect=lambda address,purpose,code: sent.append((address,purpose,code))):
                unknown=f"not-found-{secrets.token_hex(10)}@example.invalid"
                success=client.post("/demo/auth/password/forgot",json={"email":email})
                missing=client.post("/demo/auth/password/forgot",json={"email":unknown})
                self.assertEqual(success.status_code,200,success.text)
                self.assertEqual(missing.status_code,200,missing.text)
                self.assertEqual(success.json(),missing.json())
                self.assertEqual(len(sent),1)
                self.assertEqual(sent[0][:2],(email,"reset"))
                invalid="00000000" if sent[0][2]!="00000000" else "11111111"
                failed=client.post("/demo/auth/password/reset",
                    json={"email":email,"code":invalid,"new_password":new_password})
                self.assertEqual(failed.status_code,400,failed.text)
                completed=client.post("/demo/auth/password/reset",
                    json={"email":email,"code":sent[0][2],"new_password":new_password})
                self.assertEqual(completed.status_code,200,completed.text)
                self.assertTrue(completed.json()["sessions_revoked"])
                replay=client.post("/demo/auth/password/reset",
                    json={"email":email,"code":sent[0][2],"new_password":new_password})
                self.assertEqual(replay.status_code,400,replay.text)
            with SessionLocal() as db:
                self.assertIsNotNone(db.get(VerifiedEmail,account_id))
            old=client.post("/demo/auth/login",json={"email":email,"password":old_password})
            self.assertEqual(old.status_code,401,old.text)
            new=client.post("/demo/auth/login",json={"email":email,"password":new_password})
            self.assertEqual(new.status_code,200,new.text)


if __name__=="__main__":
    unittest.main()
