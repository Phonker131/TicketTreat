"""Unit-level checks for code hashing and timezone-aware expiry."""
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:5432/unused")
from demo_account_recovery import aware, code_digest


class RecoveryHelpersTests(unittest.TestCase):
    def test_otp_is_hashed_not_stored_in_plaintext(self):
        digest = code_digest(51, "verify", "12345678")
        self.assertNotEqual(digest, "12345678")
        self.assertEqual(len(digest), 64)

    def test_code_is_bound_to_account_and_purpose(self):
        first = code_digest(1, "verify", "12345678")
        self.assertNotEqual(first, code_digest(2, "verify", "12345678"))
        self.assertNotEqual(first, code_digest(1, "reset", "12345678"))

    def test_naive_db_time_is_treated_as_utc(self):
        naive = datetime(2026, 10, 21, 12, 0)
        self.assertEqual(aware(naive).utcoffset(), timedelta(0))
        self.assertEqual(aware(naive).tzinfo, timezone.utc)


if __name__ == "__main__":
    unittest.main()
