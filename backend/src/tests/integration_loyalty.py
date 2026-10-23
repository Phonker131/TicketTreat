"""PostgreSQL integration: stamps from check-in only, organizer isolation and queue priority."""
from __future__ import annotations

import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable tickettreat_ci PostgreSQL is mandatory")

import main
from db.session import SessionLocal
from demo_roles import EventOwnership
from demo_loyalty import priority_waitlist_entry
from integration_legacy import signed


class LoyaltyIntegrationTests(unittest.TestCase):
    def test_loyalty_passport_and_waitlist_priority(self):
        tg_a = secrets.randbelow(10**12) + 10**10
        tg_b = secrets.randbelow(10**12) + 10**10
        tg_c = secrets.randbelow(10**12) + 10**10
        owner_one = secrets.randbelow(2**30) + 100_000
        owner_two = owner_one + 2**30
        with TestClient(main.app) as client:
            la, lb, lc = signed(tg_a), signed(tg_b), signed(tg_c)
            sessions = [client.post("/demo/telegram/auth", json={"init_data":data})
                        for data in (la,lb,lc)]
            for session in sessions:self.assertEqual(session.status_code,200,session.text)
            ga,gb,gc = [s.json()["guest"]["id"] for s in sessions]
            unauthorized = client.get("/demo/me/loyalty")
            self.assertEqual(unauthorized.status_code,401)

            with SessionLocal() as db:
                now = datetime.now(timezone.utc)
                def event(name, owner, *, starts=None):
                    ev = main.Event(
                        title=name,organizer="Studio A" if owner==owner_one else "Studio B",
                        price=Decimal("0"),currency="CZK",max_participants=4,
                        is_cancelled=False,
                        starts_at=(starts or (now-timedelta(hours=3))).replace(tzinfo=None),
                    )
                    db.add(ev);db.flush()
                    db.add(EventOwnership(event_id=ev.id,owner_account_id=owner))
                    return ev

                # A's verified visits, including one historical visit at a second studio.
                for i in range(3):
                    ev=event("Visited A "+str(i),owner_one)
                    db.add(main.DemoTicket(
                        event_id=ev.id,guest_id=ga,qr_token=secrets.token_urlsafe(32),
                        ticket_status="active",checked_in_at=now-timedelta(minutes=30),
                        payment_status="not_required",payment_provider="free",payment_amount="0",currency="CZK",
                    ))
                other=event("Visited B",owner_two)
                db.add(main.DemoTicket(
                    event_id=other.id,guest_id=ga,qr_token=secrets.token_urlsafe(32),
                    ticket_status="active",checked_in_at=now-timedelta(minutes=30),
                    payment_status="not_required",payment_provider="free",payment_amount="0",currency="CZK",
                ))
                # An early booking by B is not a visit.
                unvisited=event("Unvisited A",owner_one)
                db.add(main.DemoTicket(
                    event_id=unvisited.id,guest_id=gb,qr_token=secrets.token_urlsafe(32),
                    ticket_status="active",checked_in_at=None,
                    payment_status="not_required",payment_provider="free",payment_amount="0",currency="CZK",
                ))
                offer_event=event("Next Studio A",owner_one,starts=now+timedelta(days=5))
                # B joined first, but A has three attended visits with this studio.
                early=db.add(main.DemoWaitlist(
                    event_id=offer_event.id,guest_id=gb,status="waiting"))
                later=db.add(main.DemoWaitlist(
                    event_id=offer_event.id,guest_id=ga,status="waiting"))
                db.flush()
                event_id=offer_event.id
                db.commit()

                winner=priority_waitlist_entry(db,db.get(main.Event,event_id),main)
                self.assertEqual(winner.guest_id,ga)
                self.assertEqual(winner.status,"waiting")
                self.assertEqual(main.get_registered_count(db,event_id),0)

            for launch in (la,lb):
                response=client.get("/demo/me/loyalty",
                    headers={"X-Telegram-Init-Data":launch})
                self.assertEqual(response.status_code,200,response.text)
                self.assertNotIn("access_token",response.text)
                self.assertNotIn("qr_token",response.text)
                data=response.json()
                self.assertEqual(data["scope"],"per_organizer")
                if launch==la:
                    self.assertEqual(len(data["studios"]),2)
                    first=next(s for s in data["studios"] if s["organizer_id"]==owner_one)
                    second=next(s for s in data["studios"] if s["organizer_id"]==owner_two)
                    self.assertEqual(first["season_visits"],3)
                    self.assertEqual(first["tier"],"regular")
                    self.assertEqual(first["remaining"],3)
                    self.assertTrue(first["perks"][0]["available"])
                    self.assertEqual(second["season_visits"],1)
                    self.assertEqual(second["tier"],"newcomer")
                    self.assertFalse(first["perks"][1]["operational"])
                    self.assertFalse(first["perks"][2]["operational"])
                else:
                    first=next(s for s in data["studios"] if s["organizer_id"]==owner_one)
                    self.assertEqual(first["season_visits"],0)
                    self.assertEqual(first["tier"],"newcomer")

            # A different organizer's queue has no loyalty priority for this member.
            with SessionLocal() as db:
                other_event=event_fn=None
                ev=main.Event(
                    title="Next Studio B",organizer="Studio B",is_cancelled=False,
                    price=Decimal("0"),currency="CZK",max_participants=4,
                    starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=5))
                db.add(ev);db.flush()
                db.add(EventOwnership(event_id=ev.id,owner_account_id=owner_two))
                db.add(main.DemoWaitlist(event_id=ev.id,guest_id=gb,status="waiting"))
                db.add(main.DemoWaitlist(event_id=ev.id,guest_id=ga,status="waiting"))
                db.flush()
                top=priority_waitlist_entry(db,ev,main)
                self.assertEqual(top.guest_id,gb)
                db.rollback()


if __name__ == "__main__":
    unittest.main()
