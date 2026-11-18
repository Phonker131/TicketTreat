"""Guests may see an organizer's loyalty steps and benefit copy, nothing private (no DB required)."""
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL","postgresql://unused:unused@127.0.0.1:5432/unused")
from demo_loyalty_benefits import LEVELS, PUBLIC_BENEFIT_FIELDS, benefit_payload, public_benefits


class PublicLoyaltyTests(unittest.TestCase):
    def benefits(self):
        return [{**benefit_payload(tier,None),"required_visits":visits} for tier,visits,*_ in LEVELS]

    def test_keeps_steps_and_copy_for_all_four_levels(self):
        public=public_benefits(self.benefits())
        self.assertEqual([b["tier"] for b in public],["newcomer","regular","insider","vip"])
        self.assertEqual([b["required_visits"] for b in public],[0,3,6,12])
        for b in public:
            self.assertTrue(b["label_en"] and b["label_cs"])

    def test_drops_editor_only_and_private_fields(self):
        raw=[{**b,"editable_enabled":True,"owner_account_id":42,"email":"private@example.org"} for b in self.benefits()]
        for b in public_benefits(raw):
            self.assertEqual(set(b),set(PUBLIC_BENEFIT_FIELDS))
            for key in ("editable_enabled","owner_account_id","email","guest_id","season_visits"):
                self.assertNotIn(key,b)

if __name__=="__main__":
    unittest.main()
