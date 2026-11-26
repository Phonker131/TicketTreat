"""Isolated check-in invitation rendering tests; no external delivery."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from demo_pilot_ops import staff_notification_context
from demo_telegram_notifications import render_message


class CheckinStaffNotificationTests(unittest.TestCase):
    def test_unknown_or_attacker_supplied_outbox_key_cannot_resolve_grant(self):
        db = Mock()
        for key in (
            "staff:grant:0:email", "staff:grant:1:email:unexpected",
            "staff:grant:1:tg:retry:bad", "staff:grant:1:email;DROP TABLE",
            "staff:grant:1:email:retry:a/bcdefghi",
        ):
            self.assertIsNone(staff_notification_context(db, key))
        db.get.assert_not_called()

    def test_telegram_invitation_is_escaped_and_least_privilege(self):
        event = SimpleNamespace(id=77, title="<VIP> & Staff",
                                location="Prague <Hall>", starts_at=None)
        row = SimpleNamespace(kind="checkin_staff", language="cs")
        text, keyboard = render_message(row, event, None)
        self.assertIn("&lt;VIP&gt; &amp; Staff", text)
        self.assertIn("Prague &lt;Hall&gt;", text)
        self.assertNotIn("<VIP>", text)
        self.assertIn("povolte fotoaparát", text)
        self.assertEqual(
            keyboard["inline_keyboard"][0][0]["url"],
            "https://tickettreat.eu/admin/check-in?event=77",
        )
        self.assertNotIn("token=", str(keyboard))


if __name__ == "__main__":
    unittest.main()
