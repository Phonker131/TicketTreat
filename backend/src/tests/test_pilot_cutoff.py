"""Venue-local booking deadlines across CEST and CET transitions."""
import unittest
from datetime import datetime,timezone
from types import SimpleNamespace
from unittest.mock import Mock,patch
from demo_pilot_ops import booking_cutoff_reached,EventPilotSettings,validate_reminders
from fastapi import HTTPException


class PilotCutoffTests(unittest.TestCase):
    def test_prague_summer_dst_is_not_utc(self):
        db=Mock()
        db.get.return_value=EventPilotSettings(event_id=1,signup_cutoff_minutes=60,
            reminder_minutes_json="[1440]")
        event=SimpleNamespace(id=1,starts_at=datetime(2026,7,1,19,0))
        with patch("demo_pilot_ops.datetime") as clock:
            clock.now.return_value=datetime(2026,7,1,16,30,tzinfo=timezone.utc)
            self.assertTrue(booking_cutoff_reached(db,event))

    def test_prague_winter_standard_time(self):
        db=Mock()
        db.get.return_value=EventPilotSettings(event_id=2,signup_cutoff_minutes=60,
            reminder_minutes_json="[1440]")
        event=SimpleNamespace(id=2,starts_at=datetime(2026,11,1,19,0))
        with patch("demo_pilot_ops.datetime") as clock:
            clock.now.return_value=datetime(2026,11,1,16,30,tzinfo=timezone.utc)
            self.assertFalse(booking_cutoff_reached(db,event))
            clock.now.return_value=datetime(2026,11,1,17,1,tzinfo=timezone.utc)
            self.assertTrue(booking_cutoff_reached(db,event))

    def test_duplicate_and_invalid_intervals_rejected(self):
        self.assertEqual(validate_reminders([180,10080,1440]),[10080,1440,180])
        for offsets in ([1440,1440],[1],[False],[10081],[]):
            with self.assertRaises(HTTPException):
                validate_reminders(offsets)


if __name__=="__main__":
    unittest.main()
