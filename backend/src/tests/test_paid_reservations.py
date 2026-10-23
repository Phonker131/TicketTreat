"""Database regression coverage for the 24h organizer-direct payment queue."""
import unittest
from datetime import datetime,timedelta,timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from sqlalchemy import create_engine, Column,Integer,String,DateTime
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from db.base import Base
from fastapi import BackgroundTasks, HTTPException
from demo_paid_reservations import decision
from demo_paid_reservations import PaidReservation,apply,pending_count,expire_for_event,now_utc

class TestEvent(Base):
    __tablename__="test_paid_event"
    id=Column(Integer,primary_key=True)
    price=Column(String(16),nullable=False)
    max_participants=Column(Integer,nullable=False)
    starts_at=Column(DateTime(timezone=True),nullable=False)
    is_cancelled=Column(Integer,default=0)

class TestGuest(Base):
    __tablename__="test_paid_guest"
    id=Column(Integer,primary_key=True)
    first_name=Column(String(80),default="Participant")
    last_name=Column(String(80),nullable=True)
    email=Column(String(120),nullable=True)

class TestTicket(Base):
    __tablename__="test_paid_ticket"
    id=Column(Integer,primary_key=True)
    event_id=Column(Integer)
    guest_id=Column(Integer)
    qr_token=Column(String(80))
    ticket_status=Column(String(20),default="active")
    payment_status=Column(String(24))
    payment_provider=Column(String(32))
    payment_amount=Column(String(32))
    currency=Column(String(3))
    acquisition_source=Column(String(40))
    checked_in_at=Column(DateTime(timezone=True),nullable=True)
    cancelled_at=Column(DateTime(timezone=True),nullable=True)

class ReservationTests(unittest.TestCase):
    def setUp(self):
        engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
        for table in (TestEvent.__table__,TestGuest.__table__,TestTicket.__table__,PaidReservation.__table__):
            table.create(engine)
        self.db=sessionmaker(bind=engine)()
        self.engine=engine
        self.db.add(TestEvent(id=1,price="200",max_participants=1,starts_at=now_utc()+timedelta(days=5),is_cancelled=0))
        self.db.add_all([TestGuest(id=1,email="one@example.invalid"),TestGuest(id=2,email="two@example.invalid")])
        self.db.commit()
        self.main=SimpleNamespace(Event=TestEvent,DemoGuest=TestGuest,DemoTicket=TestTicket,
            price_decimal=lambda value:Decimal(value),get_payment_settings=lambda db,eid:SimpleNamespace(payment_instructions="Pay the organizer"),
            normalize_event_datetime=lambda dt:dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt,
            event_has_started=lambda event:False,telegram_guest_has_bot_registration=lambda *a:False,
            get_registered_count=lambda db,eid:pending_count(db,eid))
        self.published=patch("demo_publication.require_published")
        self.cutoff=patch("demo_pilot_ops.booking_cutoff_reached",return_value=False)
        self.offers=patch("demo_waitlist_offers.offer_count",return_value=0)
        self.published.start();self.cutoff.start();self.offers.start()

    def tearDown(self):
        self.offers.stop();self.cutoff.stop();self.published.stop()
        self.db.close();self.engine.dispose()

    def test_pending_24h_hold_blocks_second_guest_and_is_idempotent(self):
        guest=self.db.get(TestGuest,1)
        first=apply(self.db,self.main,1,guest,"ru")
        again=apply(self.db,self.main,1,guest,"ru")
        self.assertEqual(first["reservation"]["id"],again["reservation"]["id"])
        self.assertEqual(first["reservation"]["status"],"pending")
        self.assertEqual(pending_count(self.db,1),1)
        expires=datetime.fromisoformat(first["reservation"]["expires_at"])
        self.assertTrue(timedelta(hours=23,minutes=59)<expires-now_utc()<=timedelta(hours=24))
        with self.assertRaises(Exception) as err:
            apply(self.db,self.main,1,self.db.get(TestGuest,2))
        self.assertIn("event_full",str(err.exception))

    def test_expired_hold_releases_capacity_and_keeps_audit_row(self):
        apply(self.db,self.main,1,self.db.get(TestGuest,1))
        row=self.db.query(PaidReservation).one()
        row.expires_at=now_utc()-timedelta(seconds=10)
        self.db.commit()
        self.assertEqual(pending_count(self.db,1),0)
        self.assertEqual(expire_for_event(self.db,1),1)
        self.db.commit()
        self.assertEqual(row.status,"expired")
        new=apply(self.db,self.main,1,self.db.get(TestGuest,2))
        self.assertEqual(new["reservation"]["status"],"pending")
        self.assertEqual(self.db.query(PaidReservation).count(),2)

    def test_no_ticket_issued_when_application_created(self):
        apply(self.db,self.main,1,self.db.get(TestGuest,1))
        self.assertEqual(self.db.query(TestTicket).count(),0)

    def test_organizer_only_can_confirm_and_ticket_is_issued_once(self):
        request=apply(self.db,self.main,1,self.db.get(TestGuest,1))
        rid=request["reservation"]["id"]
        admin=SimpleNamespace(id=111)
        from demo_roles import ensure_owner
        with patch("demo_roles.ensure_owner",side_effect=HTTPException(403,"event_not_owned")):
            with self.assertRaises(HTTPException) as denied:
                decision(self.db,self.main,1,rid,admin,True,BackgroundTasks())
            self.assertEqual(denied.exception.status_code,403)
        self.assertEqual(self.db.query(TestTicket).count(),0)
        with patch("demo_roles.ensure_owner"),patch("demo_roles.audit"),patch("demo_email.queue_email") as queue,patch("demo_email.queue_event_reminder"),patch("demo_telegram.verified_telegram_id_for_guest",return_value=None):
            first=decision(self.db,self.main,1,rid,admin,True,BackgroundTasks())
            second=decision(self.db,self.main,1,rid,admin,True,BackgroundTasks())
        self.assertEqual(first["status"],"confirmed")
        self.assertEqual(second["status"],"confirmed")
        self.assertEqual(self.db.query(TestTicket).count(),1)
        ticket=self.db.query(TestTicket).one()
        self.assertEqual(ticket.payment_provider,"organizer_direct")
        self.assertEqual(ticket.ticket_status,"active")
        self.assertEqual(ticket.payment_status,"paid")
        self.assertTrue(ticket.qr_token)
        queue.assert_called_once()

    def test_late_confirmation_cannot_issue_ticket(self):
        request=apply(self.db,self.main,1,self.db.get(TestGuest,1))
        rid=request["reservation"]["id"]
        row=self.db.get(PaidReservation,rid)
        row.expires_at=now_utc()-timedelta(seconds=1)
        self.db.commit()
        with patch("demo_roles.ensure_owner"):
            with self.assertRaises(HTTPException) as rejected:
                decision(self.db,self.main,1,rid,SimpleNamespace(id=11),True,BackgroundTasks())
        self.assertEqual(rejected.exception.status_code,409)
        self.assertEqual(self.db.query(TestTicket).count(),0)
