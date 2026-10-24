"""TicketTreat API v1 is production namespace; legacy /demo remains compatible."""
import unittest

from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from api_versioning import TicketTreatApiVersioning


class ApiVersioningTests(unittest.TestCase):
    def test_versioned_and_legacy_paths_share_all_server_side_guards(self):
        app=FastAPI()
        @app.middleware("http")
        async def block_legacy_admin(request, call_next):
            if request.url.path.startswith("/demo/admin/"):
                raise HTTPException(status_code=403, detail="admin_disabled")
            return await call_next(request)
        @app.get("/demo/health/ready")
        def ready():
            return {"status":"ready"}
        @app.get("/demo/admin/secret")
        def admin_secret():
            return {"secret":"must_not_escape"}
        app.add_middleware(TicketTreatApiVersioning)
        with TestClient(app,raise_server_exceptions=False) as client:
            self.assertEqual(client.get("/demo/health/ready").json(),{"status":"ready"})
            self.assertEqual(client.get("/api/v1/health/ready").json(),{"status":"ready"})
            self.assertEqual(client.get("/api/v1/admin/secret").status_code,500)
            self.assertEqual(client.get("/demo/admin/secret").status_code,500)
            self.assertEqual(client.get("/api/v1x/health/ready").status_code,404)
            self.assertEqual(client.get("/api/v1/").status_code,404)


if __name__=="__main__":
    unittest.main()
