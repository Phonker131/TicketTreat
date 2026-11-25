"""Requires disposable /tickettreat_ci PostgreSQL. Never runs against Railway."""
import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

from fastapi.testclient import TestClient
from db.session import SessionLocal
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa
import main
from demo_roles import EventOwnership
from demo_telegram import DemoTelegramIdentity
from demo_organizer_telegram import OrganizerActivity, queue_organizer_activity, render_organizer_activity
from demo_telegram_notifications import TelegramNotificationOutbox


class OrganizerTelegramIntegration(unittest.TestCase):
    def test_real_checkout_cancel_and_waitlist_enqueue_once(self):
        tg_id = 4000000000000 + secrets.randbelow(10**9)
        with SessionLocal() as db:
            owner, _, _, _ = account_with_session(db, "organizer")
            _, _, _, attendee_headers = account_with_session(db)
            _, _, _, waiting_headers = account_with_session(db)
            event = main.Event(title="Real event notification flow", price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                max_participants=1, currency="CZK", description="Event activity regression", location="Praha")
            db.add(event); db.flush()
            eid = event.id
            db.add(EventOwnership(event_id=eid, owner_account_id=owner.id))
            db.add(DemoTelegramIdentity(telegram_id=tg_id, guest_id=owner.guest_id))
            db.commit()
        with TestClient(main.app) as client, \
             patch("demo_telegram_notifications.configured", return_value=True):
            route = f"/demo/me/events/{eid}"
            first = client.post(route+"/checkout", headers=attendee_headers, json={"language":"en"})
            self.assertEqual(first.status_code, 200, first.text)
            ticket_id = first.json()["ticket"]["id"]
            repeat = client.post(route+"/checkout", headers=attendee_headers, json={"language":"en"})
            self.assertEqual(repeat.json()["status"], "already_registered")
            joined = client.post(route+"/waitlist", headers=waiting_headers)
            self.assertEqual(joined.status_code, 200, joined.text)
            again = client.post(route+"/waitlist", headers=waiting_headers)
            self.assertEqual(again.status_code, 200, again.text)
            cancelled = client.delete(f"/demo/me/tickets/{ticket_id}", headers=attendee_headers)
            self.assertEqual(cancelled.status_code, 200, cancelled.text)
            self.assertEqual(cancelled.json()["status"], "cancelled")
            with SessionLocal() as db:
                actions = [row.action for row in db.query(OrganizerActivity).filter_by(event_id=eid).all()]
                self.assertEqual(actions.count("registered"), 1)
                self.assertEqual(actions.count("waitlist_joined"), 1)
                self.assertEqual(actions.count("cancelled"), 1)
                self.assertEqual(actions.count("promoted"), 1)
                self.assertEqual(db.query(TelegramNotificationOutbox).filter_by(
                    event_id=eid, kind="organizer_activity").count(), 4)

    def test_preferences_dedup_privacy_owner_change_and_mfa(self):
        tg_id = 4000000000000 + secrets.randbelow(10**9)
        with SessionLocal() as db:
            owner, _, password, headers = account_with_session(db, "organizer")
            guest_owner = owner.guest_id
            second, _, _, _ = account_with_session(db, "organizer")
            _, guest, _, _ = account_with_session(db)
            guest_id = guest.id
            second_id = second.id
            event = main.Event(title="Owner test <event>", price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                max_participants=15, currency="CZK", description="Owner notification test", location="Praha")
            db.add(event); db.flush()
            eid = event.id
            db.add(EventOwnership(event_id=eid, owner_account_id=owner.id))
            db.add(DemoTelegramIdentity(telegram_id=tg_id, guest_id=guest_owner))
            db.commit()
        with TestClient(main.app) as client:
            route = "/demo/manage/telegram-notifications"
            blocked = client.get(route, headers=headers)
            self.assertEqual(blocked.status_code, 403)
            enroll_mfa(client, headers, password)
            prefs = client.get(route, headers=headers)
            self.assertEqual(prefs.status_code, 200, prefs.text)
            self.assertTrue(prefs.json()["telegram_linked"])
            self.assertTrue(prefs.json()["registrations"])
            update = client.put(route, headers=headers, json={
                "registrations": True, "cancellations": False,
                "waitlist": False, "messages": True,
            })
            self.assertEqual(update.status_code, 200, update.text)
            self.assertFalse(update.json()["waitlist"])
            self.assertFalse(update.json()["cancellations"])
        with patch("demo_telegram_notifications.configured", return_value=True):
            with SessionLocal() as db:
                self.assertFalse(queue_organizer_activity(db, event_id=eid,
                    action="waitlist_joined", source_key="waitlist:1:100", guest_id=guest_id))
                self.assertTrue(queue_organizer_activity(db, event_id=eid,
                    action="registered", source_key="ticket:1:unique", guest_id=guest_id))
                self.assertFalse(queue_organizer_activity(db, event_id=eid,
                    action="registered", source_key="ticket:1:unique", guest_id=guest_id))
                db.commit()
                activity = db.query(OrganizerActivity).filter_by(event_id=eid).one()
                outbox = db.query(TelegramNotificationOutbox).filter_by(
                    kind="organizer_activity", notice_id=activity.id).one()
                self.assertEqual(outbox.telegram_id, tg_id)
                self.assertIn("admin/events", render_organizer_activity(
                    db, outbox, db.get(main.Event, eid), main)[1]["inline_keyboard"][0][0]["url"])
                db.get(EventOwnership, eid).owner_account_id = second_id
                db.commit()
                self.assertIsNone(render_organizer_activity(
                    db, outbox, db.get(main.Event, eid), main))


if __name__ == "__main__":
    unittest.main()
