"""Timed seat invitation regression on disposable PostgreSQL only."""
import os, secrets, unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

import main
from db.session import SessionLocal
from demo_pilot_ops import EventPilotSettings
from demo_waitlist_offers import WaitlistOffer
from integration_pilot_ops import account_with_session

class WaitlistOfferTests(unittest.TestCase):
    def test_reserved_spot_claim_and_expiry_reassignment(self):
        with SessionLocal() as db:
            event=main.Event(title="Waitlist timed offer",price=Decimal("0"),
                starts_at=(datetime.now(timezone.utc)+timedelta(days=4)).replace(tzinfo=None),
                max_participants=1,currency="CZK",location="Prague")
            db.add(event);db.flush()
            _,person_a,_,a=account_with_session(db)
            _,person_b,_,b=account_with_session(db)
            _,person_c,_,c=account_with_session(db)
            original=main.DemoTicket(event_id=event.id,guest_id=person_a.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK")
            db.add(original)
            pending_b=main.DemoWaitlist(event_id=event.id,guest_id=person_b.id,status="waiting")
            pending_c=main.DemoWaitlist(event_id=event.id,guest_id=person_c.id,status="waiting")
            db.add_all([pending_b,pending_c])
            db.add(EventPilotSettings(event_id=event.id,waitlist_offer_minutes=60,
                signup_cutoff_minutes=0,reminder_minutes_json="[1440]"))
            db.commit()
            event_id=event.id; original_id=original.id
        with TestClient(main.app) as client:
            cancelled=client.delete(f"/demo/me/tickets/{original_id}",headers=a)
            self.assertEqual(cancelled.status_code,200,cancelled.text)
            self.assertIsNone(cancelled.json()["promoted_ticket_id"])
            offered=client.get(f"/demo/me/events/{event_id}/waitlist/status",headers=b)
            self.assertEqual(offered.status_code,200,offered.text)
            self.assertEqual(offered.json()["status"],"offered")
            blocked=client.post(f"/demo/me/events/{event_id}/checkout",
                json={"language":"en"},headers=c)
            self.assertEqual(blocked.status_code,409,blocked.text)
            # Expiry releases B's hold, then atomically reserves it for C.
            with SessionLocal() as db:
                invitation=db.query(WaitlistOffer).filter(
                    WaitlistOffer.event_id==event_id,WaitlistOffer.guest_id==person_b.id).first()
                invitation.expires_at=datetime.now(timezone.utc)-timedelta(minutes=1)
                db.commit()
            b_expired=client.get(f"/demo/me/events/{event_id}/waitlist/status",headers=b)
            self.assertEqual(b_expired.status_code,200,b_expired.text)
            self.assertEqual(b_expired.json()["status"],"expired")
            offered_c=client.get(f"/demo/me/events/{event_id}/waitlist/status",headers=c)
            self.assertEqual(offered_c.status_code,200,offered_c.text)
            self.assertEqual(offered_c.json()["status"],"offered")
            claimed=client.post(f"/demo/me/events/{event_id}/waitlist/claim",
                json={"language":"en"},headers=c)
            self.assertEqual(claimed.status_code,200,claimed.text)
            self.assertEqual(claimed.json()["status"],"registered")
            replay=client.post(f"/demo/me/events/{event_id}/waitlist/claim",
                json={"language":"en"},headers=c)
            self.assertEqual(replay.status_code,409,replay.text)
            self.assertEqual(main.get_registered_count(SessionLocal(),event_id),1)

if __name__=="__main__":
    unittest.main()
