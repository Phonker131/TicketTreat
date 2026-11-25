"""Pure regressions: no production database, Telegram API or secrets."""
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

from demo_organizer_telegram import (OrganizerActivity, queue_organizer_activity,
                                     render_organizer_activity)


class OrganizerTelegramTests(unittest.TestCase):
    def test_invalid_action_and_source_rejected(self):
        with self.assertRaises(ValueError):
            queue_organizer_activity(Mock(), event_id=1, action="unsupported", source_key="x")
        with self.assertRaises(ValueError):
            queue_organizer_activity(Mock(), event_id=1, action="registered", source_key="")

    def test_transactional_queue_is_idempotent_and_never_uses_caller_recipient(self):
        db = Mock()
        db.execute.return_value.scalar_one_or_none.return_value = 15
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_organizer_telegram._activity_recipients", return_value=[(42, 123456), (43, 234567)]), \
             patch("demo_telegram_notifications._insert_rows") as insert:
            result = queue_organizer_activity(db, event_id=55, action="registered",
                                              source_key="ticket:11:ab123", guest_id=7)
            self.assertTrue(result)
            rows = insert.call_args.args[1]
            self.assertEqual(len(rows), 2)
            row = rows[0]
            self.assertEqual(row["telegram_id"], 123456)
            self.assertEqual(row["event_id"], 55)
            self.assertEqual(row["kind"], "organizer_activity")
            self.assertEqual(row["notice_id"], 15)
            self.assertEqual(rows[1]["telegram_id"], 234567)
            db.execute.return_value.scalar_one_or_none.return_value = None
            self.assertFalse(queue_organizer_activity(db, event_id=55, action="registered",
                source_key="ticket:11:ab123", guest_id=7))
            self.assertEqual(insert.call_count, 1)

    def test_unlinked_or_disabled_owner_never_queues(self):
        db = Mock()
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_organizer_telegram._activity_recipients", return_value=[]):
            self.assertFalse(queue_organizer_activity(db, event_id=1,
                                                       action="cancelled", source_key="ticket:2:100"))
        with patch("demo_telegram_notifications.configured", return_value=True), \
             patch("demo_organizer_telegram._activity_recipients", return_value=[]):
            self.assertFalse(queue_organizer_activity(db, event_id=1,
                                                       action="cancelled", source_key="ticket:2:100"))
        db.execute.assert_not_called()

    def test_delivery_rechecks_owner_and_escapes_guest_name(self):
        activity = SimpleNamespace(id=7, event_id=9, guest_id=18, action="registered")
        row = SimpleNamespace(notice_id=7, event_id=9, telegram_id=999)
        event = SimpleNamespace(id=9, title="<Live> & Concert", starts_at=None)
        guest = SimpleNamespace(first_name="<Amy>", last_name="&lt;")
        main = SimpleNamespace(DemoGuest=type("DemoGuest", (), {}), get_registered_count=Mock(return_value=8))
        db = Mock()
        db.get.side_effect = lambda cls, id: activity if cls is OrganizerActivity else guest
        with patch("demo_organizer_telegram._activity_recipients", return_value=[(12, 999)]), \
             patch("demo_telegram_notifications._recipient_languages", return_value={999:"cs"}):
            text, keyboard = render_organizer_activity(db, row, event, main)
        self.assertIn("Nová registrace", text)
        self.assertIn("&lt;Live&gt; &amp; Concert", text)
        self.assertIn("&lt;Amy&gt; &amp;.", text)
        self.assertNotIn("<Live>", text)
        self.assertEqual(keyboard["inline_keyboard"][0][0]["url"],
                         "https://tickettreat.eu/admin/events/9")

        with patch("demo_organizer_telegram._activity_recipients", return_value=[(13, 777)]):
            self.assertIsNone(render_organizer_activity(db, row, event, main))

    def test_stale_activity_or_ban_skips_delivery(self):
        row = SimpleNamespace(notice_id=1, event_id=11, telegram_id=777)
        event = SimpleNamespace(id=11, title="Event", starts_at=None)
        db = Mock()
        db.get.return_value = SimpleNamespace(event_id=10, action="registered")
        self.assertIsNone(render_organizer_activity(db, row, event, Mock()))
        db.get.return_value = SimpleNamespace(event_id=11, action="registered", guest_id=None)
        with patch("demo_organizer_telegram._activity_recipients", return_value=[]):
            self.assertIsNone(render_organizer_activity(db, row, event, Mock()))


if __name__ == "__main__":
    unittest.main()
