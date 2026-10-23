"""Bot My events includes only canonical passes belonging to verified Telegram identity.

This protects against accidental same-name/email joining, duplicate event cards,
QR token leaks and reappearance of cancelled passes.
"""
import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

import main
from db.session import SessionLocal
from demo_telegram import DemoTelegramIdentity


class TelegramBotTicketVisibilityTests(unittest.TestCase):
    def test_website_ticket_visible_only_to_verified_linked_telegram(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        other_telegram_id=telegram_id+1
        with SessionLocal() as db:
            guest=main.DemoGuest(
                access_token=secrets.token_urlsafe(32), first_name="Website")
            unrelated=main.DemoGuest(
                access_token=secrets.token_urlsafe(32), first_name="Website")
            db.add_all([guest,unrelated]);db.flush()
            db.add(DemoTelegramIdentity(telegram_id=telegram_id,guest_id=guest.id))
            event=main.Event(title="Synced TicketTreat test",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                max_participants=20,currency="CZK")
            cancelled_event=main.Event(title="Cancelled pass test",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=3),
                max_participants=20,currency="CZK")
            db.add_all([event,cancelled_event]);db.flush()
            ticket=main.DemoTicket(event_id=event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK")
            cancelled=main.DemoTicket(event_id=cancelled_event.id,
                guest_id=guest.id,qr_token=secrets.token_urlsafe(32),
                ticket_status="cancelled",payment_status="not_required",
                payment_provider="free",payment_amount="0",currency="CZK")
            foreign=main.DemoTicket(event_id=cancelled_event.id,
                guest_id=unrelated.id,qr_token=secrets.token_urlsafe(32),
                ticket_status="active",payment_status="not_required",
                payment_provider="free",payment_amount="0",currency="CZK")
            db.add_all([ticket,cancelled,foreign]);db.commit()
            event_id,ticket_id=event.id,ticket.id
            qr_secret=ticket.qr_token
        with SessionLocal() as db:
            # Old legacy clients must not start seeing the new extra data.
            self.assertEqual(main.get_user_events(telegram_id,db=db),[])
            linked=main.get_user_events(
                telegram_id,include_web_tickets=True,db=db)
            self.assertEqual(len(linked),1)
            self.assertEqual(linked[0]["id"],event_id)
            self.assertEqual(linked[0]["ticket_id"],ticket_id)
            self.assertEqual(linked[0]["source"],"website_ticket")
            self.assertEqual(linked[0]["payment_status"],"not_required")
            self.assertNotIn("qr_token",str(linked))
            self.assertNotIn(qr_secret,str(linked))
            self.assertEqual(main.get_user_events(
                other_telegram_id,include_web_tickets=True,db=db),[])

    def test_canonical_card_precedes_duplicate_legacy_registration(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        with SessionLocal() as db:
            user=main.User(telegram_id=telegram_id,first_name="Linked")
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                                 first_name="Linked")
            event=main.Event(title="One entry per event",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                max_participants=25,currency="CZK")
            db.add_all([user,guest,event]);db.flush()
            db.add_all([
                DemoTelegramIdentity(telegram_id=telegram_id,guest_id=guest.id),
                main.Registration(user_id=user.id,event_id=event.id),
                main.DemoTicket(event_id=event.id,guest_id=guest.id,
                    qr_token=secrets.token_urlsafe(32),ticket_status="active",
                    payment_status="not_required",payment_provider="free",
                    payment_amount="0",currency="CZK"),
            ])
            db.commit()
            event_id=event.id
        with SessionLocal() as db:
            cards=main.get_user_events(
                telegram_id,include_web_tickets=True,db=db)
            self.assertEqual(len(cards),1)
            self.assertEqual(cards[0]["id"],event_id)
            self.assertIsNotNone(cards[0]["ticket_id"])


if __name__=="__main__":
    unittest.main()
