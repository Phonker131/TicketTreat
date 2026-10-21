"""Concurrent registration: two verified accounts racing for the last seat.

Only runs against a disposable PostgreSQL integration database in GitHub CI.
"""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Integration tests must use the disposable CI database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password


class EventCapacityTests(unittest.TestCase):
    def test_only_one_attendee_gets_last_free_seat(self):
        with SessionLocal() as db:
            event=main.Event(title="Last place concurrency check",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=3),
                max_participants=1,currency="CZK")
            db.add(event)
            db.flush()
            event_id=event.id
            accounts=[]
            for i in range(2):
                guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                    first_name="Concurrent",last_name="Attendee",
                    email=f"capacity-{secrets.token_hex(9)}@example.invalid")
                db.add(guest)
                db.flush()
                account=WebAccount(email=guest.email,
                    first_name=guest.first_name,last_name=guest.last_name,
                    contact_preference="email",guest_id=guest.id,
                    password_hash=hash_password("safe-example-password-12345"))
                db.add(account)
                db.flush()
                db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
                session=secrets.token_urlsafe(36)
                db.add(WebSession(account_id=account.id,token_hash=token_hash(session),
                    expires_at=now()+timedelta(days=5)))
                accounts.append((guest.access_token,session))
            db.commit()

        def reserve(identity):
            guest_token,session=identity
            with TestClient(main.app) as client:
                response=client.post(f"/demo/events/{event_id}/checkout",
                    json={"guest_token":guest_token,"language":"en"},
                    headers={"Authorization":"Bearer "+session})
                return response.status_code,response.json()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results=list(executor.map(reserve,accounts))
        codes=sorted(status for status,_ in results)
        self.assertEqual(codes,[200,409],results)
        self.assertEqual(main.get_registered_count(SessionLocal(),event_id),1)


if __name__=="__main__":
    unittest.main()
