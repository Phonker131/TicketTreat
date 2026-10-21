"""Calendar-month GDPR response reminders (not an automatic compliance claim)."""
import unittest
from datetime import datetime,timezone
from demo_privacy import response_due_at


class PrivacyDeadlineTests(unittest.TestCase):
    def test_month_end_and_year_rollover(self):
        self.assertEqual(
            response_due_at(datetime(2025,1,31,10,tzinfo=timezone.utc)),
            datetime(2025,2,28,10,tzinfo=timezone.utc),
        )
        self.assertEqual(
            response_due_at(datetime(2024,1,31,10,tzinfo=timezone.utc)),
            datetime(2024,2,29,10,tzinfo=timezone.utc),
        )
        self.assertEqual(
            response_due_at(datetime(2026,12,15,18,tzinfo=timezone.utc)),
            datetime(2027,1,15,18,tzinfo=timezone.utc),
        )
