import unittest

from fastapi.testclient import TestClient

from integration_organizer_rewards import enroll_mfa
from integration_pilot_ops import account_with_session
from db.session import SessionLocal
import main


class EventPhotoRemovalTests(unittest.TestCase):
    def test_remove_one_photo_keep_other_media_and_event_scoping(self):
        with SessionLocal() as db:
            _, _, password, owner = account_with_session(db, "organizer")
            _, _, second_password, other = account_with_session(db, "organizer")
            db.commit()
        png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII="
        links = ["https://example.org/one.jpg", "https://example.org/two.jpg"]
        with TestClient(main.app) as client:
            enroll_mfa(client, owner, password)
            enroll_mfa(client, other, second_password)
            base = "/api/v1/manage/events"
            created = client.post(base, headers=owner, json={
                "title": "Photo gallery", "starts_at": "2030-10-10T10:00:00Z", "languages": ["en"],
                "gallery_urls": links, "poster_data_url": png,
            })
            self.assertEqual(created.status_code, 201, created.text)
            event = f"{base}/{created.json()['id']}"
            gallery = f"{event}/gallery"
            uploads = []
            for _ in range(2):
                result = client.post(gallery, headers=owner, json={"data_url": png})
                self.assertEqual(result.status_code, 201, result.text)
                uploads.append(result.json()["id"])
            remove_link = f"{gallery}/remove-link"
            self.assertEqual(client.post(remove_link, headers=other, json={"url":links[0]}).status_code, 403)
            self.assertEqual(client.delete(f"{event}/poster", headers=other).status_code, 403)
            self.assertEqual(client.delete(f"{gallery}/{uploads[0]}", headers=other).status_code, 403)
            self.assertEqual(client.post(remove_link, headers=owner, json={"url":links[0]}).status_code, 200)
            self.assertEqual(client.delete(f"{gallery}/{uploads[0]}", headers=owner).status_code, 200)
            state = client.get(event, headers=owner).json()
            self.assertEqual(state["external_gallery_urls"], links[1:])
            self.assertEqual([p["id"] for p in state["uploaded_gallery"]], uploads[1:])
            self.assertTrue(state["uploaded_gallery"][0]["is_cover"])
            self.assertTrue(state["image_url"])
            self.assertEqual(client.delete(f"{event}/poster", headers=owner).status_code, 200)
            updated = client.get(event, headers=owner).json()
            self.assertIsNone(updated["image_url"])
            self.assertEqual(updated["gallery_urls"], state["gallery_urls"])
