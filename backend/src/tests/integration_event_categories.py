import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from integration_organizer_rewards import enroll_mfa
from integration_pilot_ops import account_with_session
import main
from db.session import SessionLocal


class EventCategoryTests(unittest.TestCase):
    def test_admin_catalog_and_organizer_event_lifecycle(self):
        with SessionLocal() as db:
            admin, _, pw, auth = account_with_session(db)
            _, _, org_pw, organizer = account_with_session(db, "organizer")
            admin_id = admin.id
            db.commit()
        with patch.dict(os.environ, {"GLOBAL_ADMIN_ACCOUNT_IDS": str(admin_id)}), TestClient(main.app) as client:
            enroll_mfa(client, auth, pw)
            enroll_mfa(client, organizer, org_pw)
            manage = "/api/v1/manage/event-categories"
            names = {"en": "Pottery workshop", "cs": "Keramická dílna"}
            self.assertEqual(client.post(manage, headers=organizer, json=names).status_code, 403)
            created = client.post(manage, headers=auth, json=names)
            self.assertEqual(created.status_code, 201, created.text)
            key = next(row["key"] for row in created.json() if row["en"] == names["en"])
            events = "/api/v1/manage/events"
            event = {"title": "Clay", "starts_at": "2030-10-10T10:00:00Z", "languages": ["en"], "tags": [key]}
            result = client.post(events, headers=organizer, json=event)
            self.assertEqual(result.status_code, 201, result.text)
            event_path = f"{events}/{result.json()['id']}"
            self.assertEqual(client.put(f"{manage}/{key}", headers=auth, json={"active": False}).status_code, 200)
            public = client.get("/api/v1/event-categories").json()
            self.assertFalse(next(row["active"] for row in public if row["key"] == key))
            self.assertEqual(client.post(events, headers=organizer, json=event).status_code, 422)
            edited = client.patch(event_path, headers=organizer, json={"title": "Clay II", "tags": [key]})
            self.assertEqual(edited.status_code, 200, edited.text)
            self.assertIn(key, client.get(event_path, headers=organizer).json()["tags"])
            self.assertEqual(client.put(f"{manage}/{key}", headers=auth, json={"active": True}).status_code, 200)
            self.assertEqual(client.post(events, headers=organizer, json=event).status_code, 201)
