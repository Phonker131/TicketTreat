"""Production-mode integration smoke checks against disposable PostgreSQL.

GitHub Actions provides a real PostgreSQL service for these tests; never
run them against a production database.
"""
import os
import unittest

from sqlalchemy import inspect, text

# The integration job sets this fixture URI; refuse to mutate other databases.
uri = os.getenv("DATABASE_URL", "")
if not uri.endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing integration database access outside tickettreat_ci")

import main
from db.session import engine


class PostgresStartupTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with engine.connect() as db:
            db.execute(text("SELECT 1"))

    def test_models_created(self):
        names = set(inspect(engine).get_table_names())
        for name in (
            "users", "events", "demo_web_accounts", "demo_web_sessions",
            "demo_event_media", "demo_site_landing", "demo_verified_emails",
            "demo_email_challenges", "demo_email_outbox",
            "demo_tickets", "demo_telegram_identities", "demo_privacy_requests", "demo_account_admin_audit", "demo_mfa_factors", "demo_mfa_sessions",
        ):
            with self.subTest(table=name):
                self.assertIn(name, names)

    def test_guest_and_profile_routes_registered(self):
        paths = {route.path for route in main.app.routes}
        for path in (
            "/demo/auth/signup", "/demo/auth/login",
            "/demo/auth/email/confirm", "/demo/auth/password/reset",
            "/demo/events/{event_id}/checkout",
            "/demo/telegram/auth", "/demo/manage/site/landing",
            "/demo/site/landing", "/demo/manage/events",
        ):
            with self.subTest(route=path):
                self.assertIn(path, paths)

    def test_health_probes(self):
        from fastapi.testclient import TestClient
        with TestClient(main.app) as client:
            self.assertEqual(client.get("/demo/health/live").status_code, 200)
            response = client.get("/demo/health/ready")
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["status"], "ready")

    def test_production_rejects_demo_guest_and_shared_admin(self):
        from fastapi.testclient import TestClient
        with TestClient(main.app) as client:
            anonymous = client.post("/demo/guests",json={
                "first_name": "Unknown", "email": "unknown@example.invalid",
            })
            self.assertEqual(anonymous.status_code,403,anonymous.text)
            legacy_admin = client.get("/demo/admin/verify",
                headers={"X-Demo-Admin-Key": "anything"})
            self.assertEqual(legacy_admin.status_code,403,legacy_admin.text)

    def test_production_disables_fake_paid_checkout(self):
        self.assertEqual(os.getenv("APP_ENV"), "production")
        self.assertFalse(main.DEMO_PAYMENT_MODE)

    def test_transactional_tables_accept_reads(self):
        with engine.connect() as db:
            for table in ("demo_event_media", "demo_site_landing", "demo_email_challenges"):
                with self.subTest(table=table):
                    db.execute(text('SELECT COUNT(*) FROM "' + table + '"')).scalar_one()


if __name__ == "__main__":
    unittest.main()
