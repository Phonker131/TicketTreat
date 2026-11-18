"""Pure rules: Czech calendar-quarter seasons and preview-only future perks."""
import unittest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from demo_loyalty import season_bounds, tier_for
from demo_loyalty_benefits import benefit_payload


class LoyaltyRulesTests(unittest.TestCase):
    def test_organizer_tiers_are_season_scoped_and_unimplemented_perks_cannot_be_enabled(self):
        self.assertEqual([benefit_payload(tier,None)["required_visits"]
                          for tier in ("newcomer","regular","insider","vip")],[0,3,6,12])
        self.assertTrue(benefit_payload("regular",None)["enabled"])
        self.assertFalse(benefit_payload("insider",None)["operational"])
        self.assertFalse(benefit_payload("vip",None)["enabled"])

    def test_custom_threshold_boundaries_and_progress(self):
        benefits=[{"tier":tier,"required_visits":n} for tier,n in
                  (("newcomer",0),("regular",2),("insider",8),("vip",15))]
        for visits,tier in ((1,"newcomer"),(2,"regular"),(7,"regular"),(8,"insider"),(15,"vip")):
            self.assertEqual(tier_for(visits,benefits)["tier"],tier)
        self.assertEqual(tier_for(5,benefits)["progress_percent"],50)
        self.assertEqual(tier_for(5,benefits)["remaining"],3)
        self.assertEqual(tier_for(5)["next_threshold"],6)

    def test_tiers_never_credit_bookings(self):
        for visits, expected, following in (
            (0, "newcomer", 3), (2, "newcomer", 3),
            (3, "regular", 6), (5, "regular", 6),
            (6, "insider", 12), (11, "insider", 12),
            (12, "vip", None), (50, "vip", None),
        ):
            with self.subTest(visits=visits):
                got=tier_for(visits)
                self.assertEqual(got["tier"],expected)
                self.assertEqual(got["next_threshold"],following)
                self.assertGreaterEqual(got["progress_percent"],0)
                self.assertLessEqual(got["progress_percent"],100)

    def test_season_bounds_prague_local_midnight_and_year_rollover(self):
        local=ZoneInfo("Europe/Prague")
        key,start,end=season_bounds(datetime(2026,10,1,0,30,tzinfo=local))
        self.assertEqual(key,"2026-Q4")
        self.assertEqual(start,datetime(2026,9,30,22,0,tzinfo=timezone.utc))
        self.assertEqual(end,datetime(2026,12,31,23,0,tzinfo=timezone.utc))
        self.assertEqual(season_bounds(datetime(2026,9,30,21,30,tzinfo=timezone.utc))[0],"2026-Q3")
        self.assertEqual(season_bounds(datetime(2026,10,1,0,30,tzinfo=local))[0],"2026-Q4")


if __name__ == "__main__":
    unittest.main()
