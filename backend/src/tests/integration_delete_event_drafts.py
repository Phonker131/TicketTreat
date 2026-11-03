"""Deletion of unused drafts: PostgreSQL + real authenticated management HTTP API.

Never run against user data: CI must provide the disposable /tickettreat_ci DB.
"""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable test PostgreSQL database required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_recovery import VerifiedEmail, now
from demo_auth_security import hash_password
from demo_mfa import _code
from demo_roles import (
    EventOwnership, EventMedia, EventGalleryImage, EventModerationLog, WebAccountRole,
)
from demo_publication import EventPublication
from demo_pilot_ops import EventPilotSettings
from demo_geography import DemoEventPlace
from demo_event_access import EventAccess
from demo_email import EventNotice, EmailOutbox


class DeleteUnusedDraftE2E(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.owner_token = self._create_organizer()
        self.other_token = self._create_organizer()

    def _create_organizer(self):
        token=secrets.token_urlsafe(36)
        password="test-organizer-password-12345"
        email=f"draft-delete-{secrets.token_hex(12)}@example.invalid"
        with SessionLocal() as db:
            guest=main.DemoGuest(first_name="Organizer",email=email,
                                 access_token=secrets.token_urlsafe(32))
            db.add(guest)
            db.flush()
            account=WebAccount(
                email=email,first_name="Organizer",last_name="Test",
                guest_id=guest.id,password_hash=hash_password(password),
                contact_preference="email",
            )
            db.add(account)
            db.flush()
            db.add(WebAccountRole(account_id=account.id,role="organizer"))
            db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
            db.add(WebSession(account_id=account.id,token_hash=token_hash(token),
                              expires_at=now()+timedelta(days=2)))
            db.commit()
        headers={"Authorization":"Bearer "+token}
        setup=self.client.post("/demo/auth/mfa/start",headers=headers,
                               json={"current_password":password})
        self.assertEqual(setup.status_code,200,setup.text)
        raw=setup.json()["secret"]
        secret=base64.b32decode(raw+"="*((8-len(raw)%8)%8))
        ready=self.client.post("/demo/auth/mfa/confirm",headers=headers,
                               json={"code":_code(secret,int(time.time())//30)})
        self.assertEqual(ready.status_code,200,ready.text)
        return token

    def _create_draft(self, private=False):
        headers={"Authorization":"Bearer "+self.owner_token}
        result=self.client.post("/demo/manage/events",headers=headers,json={
            "country_code":"CZ","city":"Prague",
            "title":"Deletion test "+secrets.token_hex(5),
            "description":"Disposable regression test event",
            "location":"Prague, test venue",
            "starts_at":(datetime.now(timezone.utc)+timedelta(days=7)).isoformat(),
            "max_participants":10,"price":"0","currency":"CZK",
            "languages":["en"],"visibility":"link_only" if private else "public",
        })
        self.assertEqual(result.status_code,201,result.text)
        self.assertEqual(result.json()["publication"]["status"],"draft")
        return result.json()["id"]

    def test_owner_deletes_unlisted_draft_and_metadata_atomically(self):
        event_id=self._create_draft(private=True)
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(EventPublication,event_id))
            self.assertIsNotNone(db.get(EventOwnership,event_id))
            self.assertIsNotNone(db.get(EventAccess,event_id))
            self.assertIsNotNone(db.get(EventPilotSettings,event_id))
            db.add(main.DemoEventPoster(
                event_id=event_id,content_type="image/png",image_bytes=b"fake-test-png"
            ))
            db.add(EventNotice(event_id=event_id,kind="change",message="Draft edited, nobody notified"))
            db.add(EventGalleryImage(
                event_id=event_id,content_type="image/png",image_bytes=b"test-gallery",
            ))
            db.commit()
        url=f"/demo/manage/events/{event_id}"
        self.assertEqual(self.client.delete(url).status_code,401)
        not_owner=self.client.delete(url,headers={
            "Authorization":"Bearer "+self.other_token
        })
        self.assertEqual(not_owner.status_code,403,not_owner.text)
        owner=self.client.delete(url,headers={"Authorization":"Bearer "+self.owner_token})
        self.assertEqual(owner.status_code,200,owner.text)
        self.assertEqual(owner.json(),{"status":"deleted","event_id":event_id})
        with SessionLocal() as db:
            self.assertIsNone(db.get(main.Event,event_id))
            for model in (EventOwnership, EventPublication, EventAccess,
                          EventPilotSettings, DemoEventPlace, EventMedia,
                          main.DemoEventPoster, main.EventLanguageSetting,
                          EventGalleryImage, EventNotice):
                self.assertIsNone(db.query(model).filter(
                    model.__table__.c.event_id==event_id).first(),model.__name__)
            self.assertEqual(db.query(EventModerationLog).filter(
                EventModerationLog.event_id==event_id,
                EventModerationLog.action=="delete").count(),1)
        self.assertFalse(any(e["id"]==event_id for e in self.client.get(
            "/demo/manage/events",headers={"Authorization":"Bearer "+self.owner_token}
        ).json()))

    def test_published_and_scheduled_events_cannot_be_deleted(self):
        event_id=self._create_draft()
        url=f"/demo/manage/events/{event_id}"
        headers={"Authorization":"Bearer "+self.owner_token}
        publish=self.client.put(url+"/publication",headers=headers,
                                json={"status":"published"})
        self.assertEqual(publish.status_code,200,publish.text)
        response=self.client.delete(url,headers=headers)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"],"only_unpublished_drafts_can_be_deleted")
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(main.Event,event_id))

    def test_draft_with_queued_notification_cannot_be_deleted(self):
        event_id=self._create_draft()
        with SessionLocal() as db:
            notice=EventNotice(event_id=event_id,kind="change",message="Queued notice")
            db.add(notice)
            db.flush()
            db.add(EmailOutbox(
                event_key="integration-draft-delete-"+secrets.token_hex(10),
                kind="event_notice",recipient="test-recipient@example.invalid",
                notice_id=notice.id,state="pending",next_attempt_at=now(),
                language="en",
            ))
            db.commit()
        response=self.client.delete(f"/demo/manage/events/{event_id}",headers={
            "Authorization":"Bearer "+self.owner_token
        })
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"],"draft_has_activity_cannot_delete")
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(main.Event,event_id))
            self.assertTrue(db.query(EventNotice.id).filter(EventNotice.event_id==event_id).first())

    def test_draft_with_historical_ticket_cannot_be_deleted(self):
        event_id=self._create_draft()
        with SessionLocal() as db:
            guest=main.DemoGuest(
                first_name="Attendee",email=f"ticket-{secrets.token_hex(9)}@example.invalid",
                access_token=secrets.token_urlsafe(32)
            )
            db.add(guest);db.flush()
            ticket=main.DemoTicket(
                event_id=event_id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),
                ticket_status="cancelled", payment_status="not_required",
                payment_provider="free",payment_amount="0",currency="CZK",
            )
            db.add(ticket)
            db.commit()
        response=self.client.delete(f"/demo/manage/events/{event_id}",headers={
            "Authorization":"Bearer "+self.owner_token
        })
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"],"draft_has_activity_cannot_delete")
        with SessionLocal() as db:
            self.assertIsNotNone(db.get(main.Event,event_id))
            self.assertTrue(db.query(main.DemoTicket.id).filter(
                main.DemoTicket.event_id==event_id).first())
