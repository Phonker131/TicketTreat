"""Safety regressions for TicketTreat Telegram event notifications.

No Railway credentials, live Telegram API calls or production database access.
"""
import unittest
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

from demo_telegram_notifications import (
    TelegramNotificationOutbox,
    queue_notice, queue_reminders_for_event, reminder_offsets, render_message, venue_start,
)


def example_event(**updates):
    info = {
        "id": 22, "title": "Evening <Concert>",
        "location": "Hall & Garden",
        "starts_at": datetime(2026, 11, 5, 19, 0),
        "is_cancelled": False,
        "reminder_text": "Bring a QR ticket <please>.",
    }
    info.update(updates)
    return SimpleNamespace(**info)


class TelegramNotificationTests(unittest.TestCase):
    def test_timestamps_use_venue_local_time(self):
        event = example_event()
        utc = venue_start(event)
        self.assertEqual(utc.tzinfo, timezone.utc)
        self.assertEqual(utc.hour, 18)  # Prague after DST change

    def test_reminder_copy_escapes_untrusted_organizer_text(self):
        item = SimpleNamespace(kind="reminder", language="en")
        text, keyboard = render_message(item, example_event(), None)
        self.assertIn("&lt;Concert&gt;", text)
        self.assertIn("&lt;please&gt;", text)
        self.assertNotIn("<Concert>", text)
        self.assertIn("Hall &amp; Garden", text)
        self.assertEqual(keyboard["inline_keyboard"][0][0]["url"], "https://tickettreat.eu/events/22")

    def test_cancel_copy_has_reason_without_raw_html(self):
        item = SimpleNamespace(kind="event_notice", language="ru")
        notice = SimpleNamespace(id=45, event_id=22, kind="cancel", message="Срочно <отмена> & перенос")
        text, _ = render_message(item, example_event(), notice)
        self.assertIn("Мероприятие отменено", text)
        self.assertIn("&lt;отмена&gt;", text)
        self.assertIn("&amp; перенос", text)

    def test_notice_one_per_registered_telegram_identity(self):
        event = example_event()
        note = SimpleNamespace(id=123)
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_telegram_notifications.recipient_ids", return_value=[111, 222]) as audience, \
             patch("demo_telegram_notifications._recipient_languages", return_value={111: "cs"}), \
             patch("demo_telegram_notifications._insert_rows") as insert:
            count = queue_notice(Mock(), notice=note, event=event, main=Mock())
        self.assertEqual(count, 2)
        audience.assert_called_once()
        rows = insert.call_args.args[1]
        self.assertEqual({r["telegram_id"] for r in rows}, {111, 222})
        self.assertEqual({r["event_key"] for r in rows}, {"tg:notice:123:111", "tg:notice:123:222"})
        self.assertEqual([r["language"] for r in rows], ["cs", "en"])  # English is BotFather default

    def test_cancellation_fans_out_to_telegram_without_resend(self):
        from demo_email import queue_event_notice, EventNotice
        db = Mock()
        event = example_event()
        with patch("demo_email.configured", return_value=False), \
             patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_telegram_notifications.queue_notice", return_value=2) as enqueue, \
             patch.dict(sys.modules, {"main": SimpleNamespace()}):
            count = queue_event_notice(
                db, event=event, kind="cancel", message="Organizer unavailable"
            )
        self.assertEqual(count, 2)
        self.assertIsInstance(db.add.call_args.args[0], EventNotice)
        self.assertEqual(db.add.call_args.args[0].kind, "cancel")
        db.flush.assert_called_once()
        enqueue.assert_called_once()

    def test_legacy_bot_reminder_offset_is_respected(self):
        event = example_event(reminder_minutes_before=45)
        db = Mock()
        db.get.return_value = None
        with patch("demo_pilot_ops.effective_settings") as settings:
            self.assertEqual(reminder_offsets(db, event), [45])
            settings.assert_not_called()

    def test_site_reminders_override_legacy_offset(self):
        event = example_event(reminder_minutes_before=45)
        db = Mock()
        db.get.return_value = object()
        with patch("demo_pilot_ops.effective_settings", return_value={"reminder_minutes": [1440, 180]}):
            self.assertEqual(reminder_offsets(db, event), [1440, 180])

    def test_future_interval_not_queued_before_due_window(self):
        now = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
        event = example_event(starts_at=datetime(2026, 11, 6, 20, 0))
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_pilot_ops.effective_settings", return_value={"reminder_minutes": [1440, 180]}), \
             patch("demo_telegram_notifications.recipient_ids") as audience:
            result = queue_reminders_for_event(Mock(), event=event, main=Mock(), now=now)
        self.assertEqual(result, 0)
        audience.assert_not_called()

    def test_due_interval_materializes_exactly_once(self):
        now = datetime(2026, 11, 5, 18, 0, tzinfo=timezone.utc)
        event = example_event(starts_at=datetime(2026, 11, 5, 22, 0))
        # Prague 22:00 = UTC 21:00; reminder at 18:00 UTC.
        db = Mock()
        db.execute.return_value.scalar_one_or_none.return_value = event.id
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_pilot_ops.effective_settings", return_value={"reminder_minutes": [180]}), \
             patch("demo_telegram_notifications.recipient_ids", return_value=[17, 18]), \
             patch("demo_telegram_notifications._recipient_languages", return_value={}), \
             patch("demo_telegram_notifications._insert_rows") as insert:
            result = queue_reminders_for_event(db, event=event, main=Mock(), now=now)
        self.assertEqual(result, 2)
        rows = insert.call_args.args[1]
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["kind"] == "reminder" for row in rows))
        self.assertEqual(len({row["event_key"] for row in rows}), 2)

    def test_cancelled_event_never_generates_reminders(self):
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_telegram_notifications.recipient_ids") as audience:
            self.assertEqual(queue_reminders_for_event(
                Mock(), event=example_event(is_cancelled=True), main=Mock()), 0)
        audience.assert_not_called()

    def test_unknown_event_notice_cannot_be_delivered_as_other_event(self):
        item = SimpleNamespace(kind="event_notice", language="en")
        with self.assertRaises(ValueError):
            render_message(item, example_event(), SimpleNamespace(event_id=999, kind="cancel", message="X"))


if __name__ == "__main__":
    unittest.main()
