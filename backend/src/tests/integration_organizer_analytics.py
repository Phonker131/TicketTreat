"""Owner isolation and registration counters on disposable PostgreSQL."""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime,timedelta,timezone
from decimal import Decimal

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Only disposable CI database allowed")
from fastapi.testclient import TestClient
import main
from db.session import SessionLocal
from demo_accounts import WebAccount,WebSession,token_hash
from demo_auth_security import hash_password
from demo_account_recovery import VerifiedEmail,now
from demo_mfa import _code
from demo_roles import WebAccountRole,EventOwnership


def organizer(db):
    name=secrets.token_hex(9)
    pw="analytics-mfa-safe-password-1234"
    guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                         first_name="Analytics",email=f"{name}@example.invalid")
    db.add(guest);db.flush()
    account=WebAccount(email=guest.email,first_name="Analytics",last_name="Owner",
                       guest_id=guest.id,password_hash=hash_password(pw),contact_preference="email")
    db.add(account);db.flush()
    db.add(WebAccountRole(account_id=account.id,role="organizer"))
    db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
    token=secrets.token_urlsafe(36)
    db.add(WebSession(account_id=account.id,token_hash=token_hash(token),
                      expires_at=now()+timedelta(days=2)))
    return account,guest,pw,{"Authorization":"Bearer "+token}


class OrganizerAnalyticsIntegration(unittest.TestCase):
    def test_own_events_and_no_attendee_secrets_in_overview(self):
        with SessionLocal() as db:
            owner,guest,pw,headers=organizer(db)
            stranger,other_guest,_,other_headers=organizer(db)
            date=(datetime.now(timezone.utc)+timedelta(days=3)).replace(tzinfo=None)
            event=main.Event(title="Analytics own event "+secrets.token_hex(5),
                             starts_at=date,price=Decimal("0"),max_participants=10,
                             currency="CZK",is_cancelled=False)
            other=main.Event(title="Private other organizer "+secrets.token_hex(5),
                             starts_at=date,price=Decimal("0"),max_participants=5,
                             currency="CZK",is_cancelled=False)
            db.add_all([event,other]);db.flush()
            db.add(EventOwnership(event_id=event.id,owner_account_id=owner.id))
            db.add(EventOwnership(event_id=other.id,owner_account_id=stranger.id))
            db.add(main.DemoTicket(event_id=event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK",acquisition_source="telegram"))
            db.add(main.DemoWaitlist(event_id=event.id,guest_id=other_guest.id,
                                      status="waiting"))
            db.add(main.DemoTicket(event_id=other.id,guest_id=other_guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK",acquisition_source="direct"))
            event_id=event.id
            other_title=other.title
            guest_email=guest.email
            other_guest_email=other_guest.email
            db.commit()
        with TestClient(main.app) as client:
            self.assertEqual(client.get("/demo/manage/analytics/overview").status_code,401)
            self.assertEqual(client.get("/demo/manage/analytics/overview",headers=headers).status_code,403)
            self.assertEqual(client.get("/demo/manage/analytics/overview",headers=other_headers).status_code,403)
            start=client.post("/demo/auth/mfa/start",headers=headers,
                              json={"current_password":pw})
            self.assertEqual(start.status_code,200,start.text)
            secret=start.json()["secret"]
            decoded=base64.b32decode(secret+"="*((8-len(secret)%8)%8))
            enrolled=client.post("/demo/auth/mfa/confirm",headers=headers,
                    json={"code":_code(decoded,int(time.time())//30)})
            self.assertEqual(enrolled.status_code,200,enrolled.text)
            report=client.get("/demo/manage/analytics/overview",headers=headers)
            self.assertEqual(report.status_code,200,report.text)
            result=report.json()
            own=next(x for x in result["events"] if x["event_id"]==event_id)
            self.assertEqual(own["reserved_places"],1)
            self.assertEqual(own["active_qr"],1)
            self.assertEqual(own["waitlist"],1)
            self.assertEqual(own["occupancy_percent"],10.0)
            self.assertNotIn(other_title,report.text)
            for name in ("qr_token","access_token",guest_email,other_guest_email):
                self.assertNotIn(name,report.text)
            self.assertTrue(any(x["source"]=="telegram" for x in result["channels"]))
            canonical=client.get("/api/v1/manage/analytics/overview",headers=headers)
            self.assertEqual(canonical.status_code,200,canonical.text)


if __name__=="__main__":
    unittest.main()
