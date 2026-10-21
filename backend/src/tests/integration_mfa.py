"""MFA end-to-end API smoke checks on isolated PostgreSQL."""
import base64
import os
import secrets
import time
import unittest
from datetime import timedelta

from fastapi.testclient import TestClient
if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Unsafe test database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount,WebSession,token_hash
from demo_roles import WebAccountRole
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password
from demo_mfa import _code


class PrivilegedMFATests(unittest.TestCase):
    def test_organizer_session_requires_real_second_factor(self):
        secret_password="mfa-unit-password-123456"
        with SessionLocal() as db:
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                first_name="MFA",last_name="User",email=f"mfa-{secrets.token_hex(10)}@example.invalid")
            db.add(guest); db.flush()
            account=WebAccount(email=guest.email,first_name="MFA",last_name="User",
                guest_id=guest.id, password_hash=hash_password(secret_password),
                contact_preference="email")
            db.add(account);db.flush()
            db.add(WebAccountRole(account_id=account.id,role="organizer"))
            db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
            bearer=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=account.id,token_hash=token_hash(bearer),
                              expires_at=now()+timedelta(days=2)))
            db.commit()

        headers={"Authorization":"Bearer "+bearer}
        with TestClient(main.app) as client:
            blocked=client.get("/demo/manage/me",headers=headers)
            self.assertEqual(blocked.status_code,403,blocked.text)
            self.assertEqual(blocked.json()["detail"],"mfa_enrollment_required")
            enrollment=client.post("/demo/auth/mfa/start",json={"current_password":secret_password},
                                   headers=headers)
            self.assertEqual(enrollment.status_code,200,enrollment.text)
            raw=enrollment.json()["secret"]
            key=base64.b32decode(raw+"="*((8-len(raw)%8)%8))
            first_code=_code(key,int(time.time())//30)
            enabled=client.post("/demo/auth/mfa/confirm",headers=headers,json={"code":first_code})
            self.assertEqual(enabled.status_code,200,enabled.text)
            self.assertTrue(enabled.json()["elevated"])
            management=client.get("/demo/manage/me",headers=headers)
            self.assertEqual(management.status_code,200,management.text)
            from demo_mfa import MFASession
            with SessionLocal() as db:
                elevation=db.get(MFASession,token_hash(bearer))
                db.delete(elevation)
                db.commit()
            challenge=client.get("/demo/manage/me",headers=headers)
            self.assertEqual(challenge.status_code,403,challenge.text)
            self.assertEqual(challenge.json()["detail"],"mfa_challenge_required")
            # The immediately reused TOTP is intentionally rejected to
            # stop MFA replay; users provide the next 30-second code.
            replay=client.post("/demo/auth/mfa/elevate",headers=headers,json={"code":first_code})
            self.assertEqual(replay.status_code,401,replay.text)


if __name__=="__main__":
    unittest.main()
