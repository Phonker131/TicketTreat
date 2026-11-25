import json
import unittest
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from demo_observability import install_request_logging, verified_account


class RequestLogTests(unittest.TestCase):
    def test_worker_identity_is_scoped_and_sensitive_input_is_omitted(self):
        app = FastAPI()
        install_request_logging(app)

        @app.get("/fixture/{sample}")
        def fixture(sample: str):
            if sample == "invalid":
                raise HTTPException(401)
            verified_account(int(sample), session_issued=True)
            return {}

        with TestClient(app) as client, self.assertLogs("tickettreat.requests") as logs:
            with ThreadPoolExecutor(3) as pool:
                responses = list(pool.map(
                    lambda s: client.get(f"/fixture/{s}?secret=private-marker",
                                         headers={"X-Account-ID": "999"}),
                    ["18", "27", "invalid"]))
        records = {row["request_id"]: row for row in
                   (json.loads(entry.getMessage()) for entry in logs.records)}
        for response, expected in zip(responses, [18, 27, None]):
            row = records[response.headers["X-Request-ID"]]
            self.assertEqual(row.get("account_id"), expected)
            self.assertEqual(bool(row.get("session_issued")), expected is not None)
            self.assertEqual(row["status"], response.status_code)
            self.assertEqual(row["route"], "/fixture/{sample}")
        self.assertNotIn("private-marker", str(records))
