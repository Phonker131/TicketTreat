"""Registry preflight must be read-only and emit aggregates, never raw identities."""
import json
import os
import unittest

from sqlalchemy import text

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Identity registry audit test only runs on disposable CI PostgreSQL")

import main
from db.session import engine

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from audit_auth_identities import audit


class AuthRegistryAuditTests(unittest.TestCase):
    def test_read_only_audit_reports_only_aggregate_counts(self):
        with engine.connect() as conn:
            before = conn.execute(text("SELECT count(*) FROM auth_identities")).scalar_one()
        report = audit(os.environ["DATABASE_URL"])
        with engine.connect() as conn:
            after = conn.execute(text("SELECT count(*) FROM auth_identities")).scalar_one()
        self.assertEqual(before, after)
        self.assertTrue(report["registry_present"])
        self.assertIn("subject_collision_groups", report)
        self.assertIn("unverified_email_reservations", report)
        self.assertIn("safe_to_backfill", report)
        self.assertTrue(all(isinstance(v, (int, bool)) for v in report.values()))
        encoded = json.dumps(report)
        self.assertNotIn("@example.invalid", encoded)

    def test_refuses_non_postgresql_urls(self):
        with self.assertRaises(ValueError):
            audit("sqlite:///:memory:")


if __name__ == "__main__":
    unittest.main()
