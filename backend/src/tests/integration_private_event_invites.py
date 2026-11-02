"""Invitation-only event access regression: real disposable PostgreSQL and HTTP API."""
import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable test PostgreSQL required")

import main
from db.session import SessionLocal
from demo_event_access import EventAccess, set_visibility, require_invite
from demo_publication import set_publication
from integration_legacy import signed


class PrivateInvitesE2E(unittest.TestCase):
    def test_unlisted_event_is_not_discoverable_or_bookable_without_link(self):
        with SessionLocal() as db:
            event = main.Event(
                title="Private invite regression " + secrets.token_hex(5),
                price=Decimal("0"), currency="CZK",
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                location="Private event test venue", max_participants=8,
            )
            db.add(event)
            db.flush()
            event_id=event.id
            db.add(main.DemoEventPoster(event_id=event_id, content_type="image/png", image_bytes=b"private-poster-test"))
            set_publication(db,event_id,"published")
            set_visibility(db,event_id,"link_only")
            token=db.get(EventAccess,event_id).invite_token
            self.assertEqual(len(token),43)
            db.commit()

        launch=signed(secrets.randbelow(10**12)+10**10)
        with TestClient(main.app) as client:
            listed=client.get("/events?include_past=true")
            self.assertEqual(listed.status_code,200,listed.text)
            self.assertNotIn(event_id,[x["id"] for x in listed.json()])
            self.assertEqual(client.get(f"/events/{event_id}").status_code,404)
            self.assertEqual(client.get(f"/events/{event_id}",headers={"X-Event-Invite":"invalid"}).status_code,404)
            self.assertEqual(client.get(f"/demo/events/{event_id}/poster").status_code,404)
            poster=client.get(f"/demo/events/{event_id}/poster?invite={token}")
            self.assertEqual(poster.status_code,200,poster.text)
            self.assertEqual(poster.headers["cache-control"],"private, no-store")
            info=client.get(f"/events/{event_id}",headers={"X-Event-Invite":token})
            self.assertEqual(info.status_code,200,info.text)
            self.assertEqual(info.json()["visibility"],"link_only")
            auth=client.post("/demo/telegram/auth",json={"init_data":launch})
            self.assertEqual(auth.status_code,200,auth.text)
            guest_headers={"X-Telegram-Init-Data":launch}
            denied=client.post(f"/demo/me/events/{event_id}/checkout",headers=guest_headers,json={"language":"en"})
            self.assertEqual(denied.status_code,404,denied.text)
            booked=client.post(f"/demo/me/events/{event_id}/checkout",headers={**guest_headers,"X-Event-Invite":token},json={"language":"en"})
            self.assertEqual(booked.status_code,200,booked.text)
            self.assertEqual(booked.json()["status"],"registered")
            visible=client.get("/demo/me/tickets",headers=guest_headers)
            self.assertEqual(visible.status_code,200,visible.text)
            self.assertTrue(any(t["event_id"]==event_id for t in visible.json()))

    def test_switching_back_to_public_revokes_link_only_requirement(self):
        with SessionLocal() as db:
            event=main.Event(title="Visibility switch "+secrets.token_hex(4),
                price=Decimal("0"),starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                currency="CZK",max_participants=4)
            db.add(event);db.flush()
            event_id=event.id
            set_publication(db,event_id,"published")
            set_visibility(db,event_id,"link_only")
            old=db.get(EventAccess,event_id).invite_token
            db.commit()
        with SessionLocal() as db:
            with self.assertRaises(Exception) as err:
                require_invite(db,event_id,None)
            self.assertEqual(getattr(err.exception,"status_code",None),404)
            set_visibility(db,event_id,"public")
            db.commit()
            self.assertIsNone(db.get(EventAccess,event_id))
        with TestClient(main.app) as client:
            public=client.get(f"/events/{event_id}")
            self.assertEqual(public.status_code,200,public.text)
            self.assertEqual(public.json()["visibility"],"public")
        self.assertEqual(len(old),43)
