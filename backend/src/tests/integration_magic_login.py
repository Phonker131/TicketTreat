"""One-time passwordless login with a single-use challenge and no MFA bypass."""
import os
import secrets
import unittest
from datetime import timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password


class MagicLoginIntegrationTests(unittest.TestCase):
    def test_verified_account_login_one_use_and_unknown_email_indistinguishable(self):
        email=f"magic-{secrets.token_hex(10)}@example.invalid"
        with SessionLocal() as db:
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                first_name="Magic",last_name="User",email=email)
            db.add(guest);db.flush()
            account=WebAccount(email=email,first_name="Magic",last_name="User",
                password_hash=hash_password("magic-example-password-2026"),
                contact_preference="email",guest_id=guest.id)
            db.add(account);db.flush()
            db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
            db.commit()

        sent=[]
        with TestClient(main.app) as client:
            with patch("demo_email.configured",return_value=True),patch(
                    "demo_account_recovery.send_code",side_effect=lambda address,purpose,code:sent.append((address,purpose,code))):
                requested=client.post("/demo/auth/magic/request",json={"email":email})
                self.assertEqual(requested.status_code,200,requested.text)
                missing=client.post("/demo/auth/magic/request",
                    json={"email":f"missing-{secrets.token_hex(8)}@example.invalid"})
                self.assertEqual(missing.status_code,200,missing.text)
                self.assertEqual(requested.json(),missing.json())
                self.assertEqual(len(sent),1)
                self.assertEqual(sent[0][:2],(email,"login"))
                bad=client.post("/demo/auth/magic/confirm",
                    json={"email":email,"code":"00000000" if sent[0][2]!="00000000" else "11111111"})
                self.assertEqual(bad.status_code,400,bad.text)
                success=client.post("/demo/auth/magic/confirm",
                    json={"email":email,"code":sent[0][2]})
                self.assertEqual(success.status_code,200,success.text)
                token=success.json()["token"]
                self.assertGreaterEqual(len(token),30)
                self.assertEqual(client.get("/demo/auth/me",
                    headers={"Authorization":"Bearer "+token}).status_code,200)
                replay=client.post("/demo/auth/magic/confirm",
                    json={"email":email,"code":sent[0][2]})
                self.assertEqual(replay.status_code,400,replay.text)


if __name__=="__main__":
    unittest.main()
