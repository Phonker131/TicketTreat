"""Pure preview-program rules; no paid subscription can be created here."""
import unittest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from demo_organizer_subscription_rewards import (DEFAULT_LEVELS, discount_progress,
                                                  rolling_three_months)


class OrganizerSubscriptionRewardsTests(unittest.TestCase):
    def test_rolling_three_calendar_months_in_prague(self):
        prague=ZoneInfo("Europe/Prague")
        start,end=rolling_three_months(datetime(2026,11,18,12,30,tzinfo=timezone.utc))
        self.assertEqual(start,datetime(2026,8,18,13,30,tzinfo=prague))
        self.assertEqual(end,datetime(2026,11,18,13,30,tzinfo=prague))
        start,_=rolling_three_months(datetime(2026,5,31,12,tzinfo=prague))
        self.assertEqual(start.day,28)
        self.assertEqual(start.month,2)

    def test_discount_is_preview_only_and_progress_never_exceeds_next_threshold(self):
        levels=[{"tier":tier,"min_events":at,"discount_pct":discount}
                for tier,at,discount in DEFAULT_LEVELS]
        for count,tier,pct,remaining in ((0,"starter",0,3),(2,"starter",0,1),
                                         (3,"bronze",10,3),(5,"bronze",10,1),
                                         (6,"silver",20,5),(11,"gold",30,9),
                                         (20,"platinum",40,0),(300,"platinum",40,0)):
            result=discount_progress(count,levels)
            self.assertEqual((result["tier"],result["discount_pct"],result["events_to_next"]),
                             (tier,pct,remaining))


if __name__ == "__main__":
    unittest.main()
