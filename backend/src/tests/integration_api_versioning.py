"""Live FastAPI + disposable CI PostgreSQL smoke test for TicketTreat v1 aliases."""
import os
import unittest
from fastapi.testclient import TestClient

if not os.environ.get("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Only disposable tickettreat_ci database is allowed")

import main


class ApiVersioningIntegration(unittest.TestCase):
    def test_production_v1_alias_and_legacy_guard(self):
        with TestClient(main.app) as client:
            for prefix in ("/demo","/api/v1"):
                ready=client.get(prefix+"/health/ready")
                self.assertEqual(ready.status_code,200,ready.text)
                self.assertEqual(ready.json()["status"],"ready")
                protected=client.get(prefix+"/me/tickets")
                self.assertIn(protected.status_code,(401,403),protected.text)
                legacy_admin=client.get(prefix+"/admin/verify")
                self.assertEqual(legacy_admin.status_code,403,legacy_admin.text)
                profile=client.get(prefix+"/auth/me")
                self.assertIn(profile.status_code,(401,403),profile.text)


if __name__=="__main__":
    unittest.main()
