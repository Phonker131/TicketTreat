"""Bot/Web identity invariants on disposable real PostgreSQL only.

Never run against production, never put private bot secrets in logs.
"""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from decimal import Decimal
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import event as sql_event
from db.session import engine

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing bot integration against non-CI PostgreSQL")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_identity_registry import AuthIdentity
from demo_telegram import DemoTelegramIdentity
from demo_legacy import LegacyTicketClaim
from integration_legacy import signed


class CanonicalBotTicketTests(unittest.TestCase):
    def setUp(self):
        self.old_isolated=main.DEMO_ISOLATED_API
        self.env=patch.dict(os.environ,{
            "BOT_API_KEY":"ci-bot-private-api-key-123456789012345",
            "BOT_CANONICAL_REGISTRATION":"true",
            "TICKETTREAT_IDENTITY_REGISTRY_MODE":"shadow",
        })
        self.env.start()
        main.DEMO_ISOLATED_API=False
        self.key={"X-Bot-Api-Key":os.environ["BOT_API_KEY"]}

    def tearDown(self):
        main.DEMO_ISOLATED_API=self.old_isolated
        self.env.stop()

    @staticmethod
    def seed_user_event(*,capacity=2,paid=False):
        user_id=secrets.randbelow(10**12)+10**10
        with SessionLocal() as db:
            user=main.User(telegram_id=user_id,first_name="Bot User",username="bot_ci")
            event=main.Event(
                title="Bot canonical integration",price=Decimal("250" if paid else "0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=5),
                max_participants=capacity,currency="CZK",
            )
            db.add_all([user,event]);db.commit()
            return user_id,event.id

    def test_new_bot_registration_has_one_canonical_account_one_ticket_and_one_seat(self):
        telegram_id,event_id=self.seed_user_event()
        with TestClient(main.app) as client:
            path=f"/events/{event_id}/register"
            req={"telegram_id":telegram_id}
            first=client.post(path,headers=self.key,json=req)
            self.assertEqual(first.status_code,200,first.text)
            self.assertEqual(first.json()["status"],"registered")
            again=client.post(path,headers=self.key,json=req)
            self.assertEqual(again.status_code,200,again.text)
            self.assertEqual(again.json()["status"],"already_registered")
            with SessionLocal() as db:
                identity=db.get(DemoTelegramIdentity,telegram_id)
                self.assertIsNotNone(identity)
                account=db.query(WebAccount).filter(WebAccount.guest_id==identity.guest_id).one()
                claim=db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="telegram",
                    AuthIdentity.provider_subject==str(telegram_id),
                ).one()
                self.assertEqual(claim.account_id,account.id)
                tickets=db.query(main.DemoTicket).filter(
                    main.DemoTicket.event_id==event_id,
                    main.DemoTicket.guest_id==identity.guest_id,
                ).all()
                self.assertEqual(len(tickets),1)
                self.assertEqual(tickets[0].ticket_status,"active")
                reg=db.query(main.Registration).filter(
                    main.Registration.event_id==event_id).one()
                self.assertEqual(db.get(LegacyTicketClaim,reg.id).ticket_id,tickets[0].id)
                self.assertEqual(main.get_registered_count(db,event_id),1)
                guest_id=identity.guest_id
            # Simulated independently signed Mini App login must find precisely
            # the bot's QR ticket-owner, not create a parallel web account.
            main.DEMO_ISOLATED_API=True
            launched=client.post("/demo/telegram/auth",json={"init_data":signed(telegram_id)})
            main.DEMO_ISOLATED_API=False
            self.assertEqual(launched.status_code,200,launched.text)
            self.assertEqual(launched.json()["guest"]["id"],guest_id)
            with SessionLocal() as db:
                self.assertEqual(db.query(WebAccount).filter(
                    WebAccount.guest_id==guest_id).count(),1)
                self.assertEqual(main.get_registered_count(db,event_id),1)
            # Legacy bot cancellation must cancel the QR entry, not orphan
            # a paid/checked-in ticket and leave a ghost capacity hold.
            cancelled=client.delete(
                f"/events/{event_id}/register/{telegram_id}",headers=self.key)
            self.assertEqual(cancelled.status_code,200,cancelled.text)
            self.assertEqual(cancelled.json()["status"],"unsubscribed")
            with SessionLocal() as db:
                self.assertEqual(main.get_registered_count(db,event_id),0)
                entry=db.query(main.DemoTicket).filter(
                    main.DemoTicket.event_id==event_id,
                    main.DemoTicket.guest_id==guest_id,
                ).one()
                self.assertEqual(entry.ticket_status,"cancelled")
            repeated=client.delete(
                f"/events/{event_id}/register/{telegram_id}",headers=self.key)
            self.assertEqual(repeated.status_code,200,repeated.text)
            self.assertEqual(repeated.json()["status"],"unsubscribed")

    def test_concurrent_bot_bookings_do_not_duplicate_one_guest_or_oversell(self):
        first_id,event_id=self.seed_user_event(capacity=1)
        second_id,_=self.seed_user_event(capacity=1)
        with TestClient(main.app) as client:
            def request(telegram_id):
                return client.post(f"/events/{event_id}/register",headers=self.key,
                                   json={"telegram_id":telegram_id})
            with ThreadPoolExecutor(max_workers=4) as pool:
                out=list(pool.map(request,[first_id,second_id,first_id,second_id]))
            self.assertTrue(all(r.status_code==200 for r in out),[r.text for r in out])
            with SessionLocal() as db:
                self.assertEqual(main.get_registered_count(db,event_id),1)
                self.assertEqual(db.query(main.DemoTicket).filter(
                    main.DemoTicket.event_id==event_id,
                    main.DemoTicket.ticket_status=="active",
                ).count(),1)
                for tid in (first_id,second_id):
                    self.assertLessEqual(db.query(DemoTelegramIdentity).filter(
                        DemoTelegramIdentity.telegram_id==tid).count(),1)

    def test_telegram_lock_is_acquired_before_event_row_lock(self):
        telegram_id,event_id=self.seed_user_event()
        observed=[]
        def capture(_conn,_cursor,statement,_params,_context,_many):
            sql=statement.lower()
            if "pg_advisory_xact_lock" in sql:
                observed.append("telegram")
            elif "from events" in sql and "for update" in sql:
                observed.append("event")
        sql_event.listen(engine,"before_cursor_execute",capture)
        try:
            with TestClient(main.app) as client:
                response=client.post(f"/events/{event_id}/register",
                    headers=self.key,json={"telegram_id":telegram_id})
            self.assertEqual(response.status_code,200,response.text)
        finally:
            sql_event.remove(engine,"before_cursor_execute",capture)
        self.assertIn("telegram",observed)
        self.assertIn("event",observed)
        self.assertLess(observed.index("telegram"),observed.index("event"))

    def test_old_paid_registration_stays_legacy_not_fake_confirmed(self):
        telegram_id,event_id=self.seed_user_event(paid=True)
        with TestClient(main.app) as client:
            result=client.post(f"/events/{event_id}/register",headers=self.key,
                               json={"telegram_id":telegram_id})
            self.assertEqual(result.status_code,200,result.text)
            self.assertEqual(result.json()["error"],"paid_events_disabled")
            with SessionLocal() as db:
                self.assertEqual(main.get_registered_count(db,event_id),0)
                self.assertEqual(db.query(main.DemoTicket).filter(
                    main.DemoTicket.event_id==event_id).count(),0)


if __name__=="__main__":
    unittest.main()
