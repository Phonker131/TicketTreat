"""Uploaded broadcast photos: owner MFA, durable bytes, and unguessable public link.

Runs only against disposable PostgreSQL in CI. Never sends email or Telegram.
"""
import base64
import io
import os
import re
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing uploaded-media tests outside disposable PostgreSQL")

import main
from db.session import SessionLocal
from integration_event_chat import enroll_mfa
from integration_pilot_ops import account_with_session
from demo_broadcast import BroadcastImage


class UploadedBroadcastMediaTests(unittest.TestCase):
    def test_owner_protected_upload_and_random_public_jpeg(self):
        with SessionLocal() as db:
            owner, _, password, headers = account_with_session(db, "organizer")
            owner_id = owner.id
            db.commit()

        photo = Image.new("RGB", (120, 80), (33, 99, 155))
        output = io.BytesIO()
        photo.save(output, "PNG")
        data_url = "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()
        with TestClient(main.app) as client, patch.dict(
            os.environ, {"WEB_APP_URL": "https://tickettreat.eu"}
        ):
            endpoint = "/demo/manage/broadcasts/media"
            self.assertIn(client.post(endpoint, json={"data_url": data_url}).status_code, (401, 403))
            self.assertEqual(client.post(endpoint, headers=headers,
                                         json={"data_url": data_url}).status_code, 403)
            enroll_mfa(client, headers, password)
            uploaded = client.post(endpoint, headers=headers, json={"data_url": data_url})
            self.assertEqual(uploaded.status_code, 201, uploaded.text)
            url = uploaded.json()["image_url"]
            self.assertRegex(url, r"^https://tickettreat\.eu/api/gateway/demo/public/broadcast-media/[A-Za-z0-9_-]{43}$")
            token = url.rsplit("/", 1)[1]
            image = client.get("/demo/public/broadcast-media/" + token)
            self.assertEqual(image.status_code, 200, image.text[:200] if image.status_code != 200 else "")
            self.assertEqual(image.headers["content-type"], "image/jpeg")
            self.assertEqual(image.content[:3], b"\xff\xd8\xff")
            self.assertEqual(client.get("/demo/public/broadcast-media/" + "X" * 43).status_code, 404)
            self.assertEqual(client.get("/demo/public/broadcast-media/invalid").status_code, 404)
            with SessionLocal() as db:
                row = db.get(BroadcastImage, token)
                self.assertIsNotNone(row)
                self.assertEqual(row.owner_account_id, owner_id)
                self.assertEqual(row.image_bytes, image.content)


if __name__ == "__main__":
    unittest.main()
