"""Free-pilot scoped staffing, settings and admission regressions.

Runs only on the isolated CI PostgreSQL database; never accesses Railway.
"""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_roles import WebAccountRole, EventOwnership
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password
from demo_mfa import _code


def account_with_session(db, role="participant"):
    email=f"pilot-{secrets.token_hex(12)}@example.invalid"
    pw="pilot-safe-password-2026"
    guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                         first_name="Pilot",last_name="User",email=email)
    db.add(guest);db.flush()
    user=WebAccount(email=email,first_name="Pilot",last_name="User",
                    guest_id=guest.id,password_hash=hash_password(pw),
                    contact_preference="email")
    db.add(user);db.flush()
    db.add(VerifiedEmail(account_id=user.id,verified_at=now()))
    db.add(WebAccountRole(account_id=user.id,role=role))
    token=secrets.token_urlsafe(36)
    db.add(WebSession(account_id=user.id,token_hash=token_hash(token),
                      expires_at=now()+timedelta(days=3)))
    return user,guest,pw,{"Authorization":"Bearer "+token}


class PilotScopedOperationsTests(unittest.TestCase):
    def test_checkin_grant_metrics_cutoff_and_revocation(self):
        with SessionLocal() as db:
            event=main.Event(title="Pilot staff scoped checkin",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                max_participants=5,currency="CZK",description="CI pilot event",location="Prague")
            db.add(event);db.flush()
            organizer,_,password,owner_headers=account_with_session(db,"organizer")
            worker,_,_,worker_headers=account_with_session(db)
            attendee,guest,_,attendee_headers=account_with_session(db)
            db.add(EventOwnership(event_id=event.id,owner_account_id=organizer.id))
            ticket=main.DemoTicket(event_id=event.id,guest_id=guest.id,
                    qr_token=secrets.token_urlsafe(32),ticket_status="active",
                    payment_status="not_required",payment_provider="free",
                    payment_amount="0",currency="CZK")
            db.add(ticket);db.commit()
            event_id=event.id
            qr=ticket.qr_token
            worker_id=worker.id

        with TestClient(main.app) as client:
            owner=client.get(f"/demo/manage/events/{event_id}/insights",headers=owner_headers)
            self.assertEqual(owner.status_code,403)
            enroll=client.post("/demo/auth/mfa/start",headers=owner_headers,
                json={"current_password":password})
            self.assertEqual(enroll.status_code,200,enroll.text)
            raw=enroll.json()["secret"]
            secret=base64.b32decode(raw+"="*((8-len(raw)%8)%8))
            enabled=client.post("/demo/auth/mfa/confirm",headers=owner_headers,
                json={"code":_code(secret,int(time.time())//30)})
            self.assertEqual(enabled.status_code,200,enabled.text)
            report=client.get(f"/demo/manage/events/{event_id}/insights",headers=owner_headers)
            self.assertEqual(report.status_code,200,report.text)
            self.assertEqual(report.json()["active_qr_tickets"],1)
            self.assertEqual(report.json()["checked_in"],0)
            settings=client.put(f"/demo/manage/events/{event_id}/pilot-settings",
                headers=owner_headers,json={"signup_cutoff_minutes":10080,
                                            "reminder_minutes":[10080,1440,180]})
            self.assertEqual(settings.status_code,200,settings.text)
            booking=client.post(f"/demo/me/events/{event_id}/checkout",
                headers=attendee_headers,json={"language":"en"})
            self.assertEqual(booking.status_code,409,booking.text)
            self.assertEqual(booking.json()["detail"],"event_registration_closed")
            bad=client.put(f"/demo/manage/events/{event_id}/pilot-settings",
                headers=owner_headers,json={"signup_cutoff_minutes":0,
                                            "reminder_minutes":[1440,1440]})
            self.assertEqual(bad.status_code,422,bad.text)
            denied=client.post("/demo/pilot/check-in",headers=worker_headers,
                               json={"qr_token":qr})
            self.assertEqual(denied.status_code,403,denied.text)
            granted=client.post(f"/demo/manage/events/{event_id}/checkin-staff",
                headers=owner_headers,json={"email":worker.email})
            self.assertEqual(granted.status_code,201,granted.text)
            forbidden=client.get(f"/demo/manage/events/{event_id}/participants",
                                 headers=worker_headers)
            self.assertEqual(forbidden.status_code,403,forbidden.text)
            admitted=client.post("/demo/pilot/check-in",headers=worker_headers,
                                 json={"qr_token":qr})
            self.assertEqual(admitted.status_code,200,admitted.text)
            self.assertEqual(admitted.json()["status"],"checked_in")
            self.assertNotIn("qr_token",admitted.json()["ticket"])
            self.assertNotIn("access_token",admitted.json()["ticket"]["guest"])
            duplicate=client.post("/demo/pilot/check-in",headers=worker_headers,
                                  json={"qr_token":qr})
            self.assertEqual(duplicate.status_code,200,duplicate.text)
            self.assertEqual(duplicate.json()["status"],"already_checked_in")
            history=client.get("/demo/me/attendance",headers=attendee_headers)
            self.assertEqual(history.status_code,200,history.text)
            self.assertEqual(history.json()["visit_count"],1)
            updated=client.get(f"/demo/manage/events/{event_id}/insights",headers=owner_headers)
            self.assertEqual(updated.json()["checked_in"],1)
            revoked=client.delete(
                f"/demo/manage/events/{event_id}/checkin-staff/{worker_id}",
                headers=owner_headers)
            self.assertEqual(revoked.status_code,200,revoked.text)
            rejected=client.post("/demo/pilot/check-in",headers=worker_headers,
                                 json={"qr_token":qr})
            self.assertEqual(rejected.status_code,403,rejected.text)


if __name__ == "__main__":
    unittest.main()
