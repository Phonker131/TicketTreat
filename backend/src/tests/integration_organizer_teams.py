"""Organizer tenancy and multi-recipient Telegram: disposable PostgreSQL only."""
import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable CI database required")

from fastapi.testclient import TestClient
from db.session import SessionLocal
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa
from demo_roles import EventOwnership, role_for
from demo_telegram import DemoTelegramIdentity
from demo_organizer_teams import OrganizerTeamMember
from demo_organizer_telegram import queue_organizer_activity, render_organizer_activity
from demo_telegram_notifications import TelegramNotificationOutbox
import main


class OrganizerTeamsIntegration(unittest.TestCase):
    def test_verified_invitation_revoke_mfa_tenancy_and_telegram(self):
        with SessionLocal() as db:
            owner, _, owner_pw, owner_headers = account_with_session(db, "organizer")
            worker, _, worker_pw, worker_headers = account_with_session(db)
            outsider, _, outside_pw, outsider_headers = account_with_session(db, "organizer")
            event = main.Event(title="Delegated event"+secrets.token_hex(5),
                price=Decimal("0"), starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                max_participants=15, currency="CZK", description="Scoped team test", location="Praha")
            strange = main.Event(title="Unrelated event"+secrets.token_hex(5),
                price=Decimal("0"), starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=2),
                max_participants=15, currency="CZK", description="Other organizer", location="Praha")
            db.add_all([event, strange]); db.flush()
            db.add(EventOwnership(event_id=event.id, owner_account_id=owner.id))
            db.add(EventOwnership(event_id=strange.id, owner_account_id=outsider.id))
            # An accepted member's separately signed Telegram is sufficient;
            # the owner may have none, and no Telegram identity is ever merged.
            tg_id = 5000000000000 + secrets.randbelow(10**9)
            db.add(DemoTelegramIdentity(telegram_id=tg_id, guest_id=worker.guest_id))
            db.commit()
            owner_id, worker_id, other_owner_id, event_id, other_id = owner.id, worker.id, outsider.id, event.id, strange.id
            worker_email = worker.email

        with TestClient(main.app) as client:
            self.assertEqual(client.get("/demo/manage/events", headers=worker_headers).status_code, 403)
            self.assertEqual(client.get("/demo/manage/teams", headers=worker_headers).status_code, 200)
            enroll_mfa(client, owner_headers, owner_pw)
            invalid = client.post("/demo/manage/teams/invitations", headers=owner_headers,
                                  json={"email": owner_headers["Authorization"]})
            self.assertEqual(invalid.status_code, 422)
            invited = client.post("/demo/manage/teams/invitations", headers=owner_headers,
                                  json={"email": worker_email})
            self.assertEqual(invited.status_code, 201, invited.text)
            self.assertEqual(client.get("/demo/manage/events", headers=worker_headers).status_code, 403)
            pending = client.get("/demo/manage/teams", headers=worker_headers).json()["teams"]
            self.assertEqual([(r["owner_account_id"],r["status"]) for r in pending],[(owner_id,"invited")])
            # Expired invitations cannot grant access and can be reissued.
            with SessionLocal() as db:
                pending_row = db.get(OrganizerTeamMember, (owner_id, worker_id))
                pending_row.invited_at = datetime.now(timezone.utc)-timedelta(days=8)
                db.commit()
            self.assertEqual(client.post(f"/demo/manage/teams/invitations/{owner_id}/accept",
                headers=worker_headers).status_code, 410)
            self.assertEqual(client.get("/demo/manage/teams", headers=worker_headers).json()["teams"],[])
            self.assertEqual(client.post("/demo/manage/teams/invitations", headers=owner_headers,
                json={"email": worker_email}).status_code,201)
            # A stranger cannot accept somebody else's invitation.
            self.assertEqual(client.post(f"/demo/manage/teams/invitations/{owner_id}/accept",
                headers=outsider_headers).status_code, 403)  # organizer MFA not yet verified
            self.assertEqual(client.post(f"/demo/manage/teams/invitations/{owner_id}/accept",
                headers=worker_headers).status_code, 200)
            # Accepted team membership immediately requires its own MFA, even
            # though the web account's canonical role remains 'participant'.
            self.assertEqual(client.get("/demo/manage/events", headers=worker_headers).status_code, 403)
            self.assertTrue(client.get("/demo/auth/mfa/status", headers=worker_headers).json()["team_access"])
            enroll_mfa(client, worker_headers, worker_pw)
            listings = client.get("/demo/manage/events", headers=worker_headers)
            self.assertEqual(listings.status_code, 200, listings.text)
            self.assertIn(event_id,[row["id"] for row in listings.json()])
            self.assertNotIn(other_id,[row["id"] for row in listings.json()])
            self.assertEqual(client.get(f"/demo/manage/events/{other_id}",headers=worker_headers).status_code,403)
            identity = client.get("/demo/manage/me", headers=worker_headers).json()
            self.assertEqual(identity["role"], "organizer")
            self.assertEqual(identity["base_role"], "participant")
            self.assertEqual(identity["team_organization_ids"], [owner_id])
            created = client.post("/demo/manage/events", headers=worker_headers, json={
                "organization_account_id": owner_id, "title": "Delegated draft " + secrets.token_hex(4),
                "organizer": "Amber Events", "starts_at": (datetime.now(timezone.utc)+timedelta(days=5)).isoformat(),
                "location": "Praha", "max_participants": 15, "languages": ["en"], "price": "0",
            })
            self.assertEqual(created.status_code, 201, created.text)
            delegated_id = created.json()["id"]
            with SessionLocal() as db:
                self.assertEqual(db.get(EventOwnership, delegated_id).owner_account_id, owner_id)
            self.assertEqual(client.delete(f"/demo/manage/events/{delegated_id}",
                headers=worker_headers).status_code,403)
            self.assertEqual(client.post("/demo/manage/events",headers=worker_headers,json={
                "organization_account_id": other_owner_id,
                "title": "Forbidden", "starts_at": (datetime.now(timezone.utc)+timedelta(days=5)).isoformat(),
                "languages": ["en"]}).status_code,403)
            self.assertEqual(client.get("/demo/manage/organizers", headers=worker_headers).status_code,403)
            self.assertEqual(client.get("/demo/manage/organizer-profile", headers=worker_headers).status_code,403)
            with SessionLocal() as db:
                self.assertEqual(role_for(db,db.get(type(owner),worker_id)),"participant")
            with patch("demo_telegram_notifications.configured", return_value=True):
                with SessionLocal() as db:
                    self.assertTrue(queue_organizer_activity(db,event_id=event_id,
                        action="registered",source_key="team:"+secrets.token_hex(8)))
                    db.commit()
                    row = db.query(TelegramNotificationOutbox).filter(
                        TelegramNotificationOutbox.kind=="organizer_activity",
                        TelegramNotificationOutbox.event_id==event_id).order_by(
                        TelegramNotificationOutbox.id.desc()).first()
                    self.assertEqual(row.telegram_id,tg_id)
                    self.assertIsNotNone(render_organizer_activity(db,row,db.get(main.Event,event_id),main))
                # Explicit leave revokes management and suppresses queued alerts.
                self.assertEqual(client.post(f"/demo/manage/teams/{owner_id}/leave",
                    headers=worker_headers).status_code,200)
                with SessionLocal() as db:
                    self.assertIsNone(render_organizer_activity(db,row,db.get(main.Event,event_id),main))
                    self.assertEqual(db.get(OrganizerTeamMember,(owner_id,worker_id)).status,"revoked")
            self.assertEqual(client.get("/demo/manage/events", headers=worker_headers).status_code,403)
            self.assertFalse(client.get("/demo/auth/mfa/status", headers=worker_headers).json()["team_access"])


if __name__ == "__main__":
    unittest.main()
