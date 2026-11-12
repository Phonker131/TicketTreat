"""Rewards are organizer-scoped, backed by a real recorded QR check-in.

Runs exclusively on disposable PostgreSQL, no emails/Telegram notifications.
"""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing reward tests outside disposable PostgreSQL")

import main
from db.session import SessionLocal
from demo_roles import EventOwnership
from demo_mfa import _code
from demo_rewards import RewardGrant
from integration_pilot_ops import account_with_session

def enroll_mfa(client,headers,password):
    enrolled=client.post("/demo/auth/mfa/start",headers=headers,
                         json={"current_password":password})
    assert enrolled.status_code==200,enrolled.text
    secret=enrolled.json()["secret"]
    decoded=base64.b32decode(secret+"="*((8-len(secret)%8)%8))
    confirmed=client.post("/demo/auth/mfa/confirm",headers=headers,
                          json={"code":_code(decoded,int(time.time())//30)})
    assert confirmed.status_code==200,confirmed.text

class OrganizerAwardIntegration(unittest.TestCase):
    def test_real_checkin_only_duplicate_proof_scoping_wallet_and_revoke(self):
        with SessionLocal() as db:
            organizer,_,pw,auth=account_with_session(db,"organizer")
            other,_,other_pw,other_auth=account_with_session(db,"organizer")
            attendee,guest,_,guest_auth=account_with_session(db,"participant")
            attendee_id=attendee.id
            when=(datetime.now(timezone.utc)-timedelta(hours=2)).replace(tzinfo=None)
            ev=main.Event(title="Recognition owner event "+secrets.token_hex(4),
                         starts_at=when,price=Decimal("0"),currency="CZK",
                         max_participants=15,is_cancelled=False)
            outsider=main.Event(title="Recognition outside event "+secrets.token_hex(4),
                         starts_at=when,price=Decimal("0"),currency="CZK",
                         max_participants=15,is_cancelled=False)
            repeat_event=main.Event(title=ev.title,
                         starts_at=when+timedelta(days=7),
                         price=Decimal("0"),currency="CZK",
                         max_participants=15,is_cancelled=False)
            db.add_all([ev,outsider,repeat_event]);db.flush()
            db.add_all([
                EventOwnership(event_id=ev.id,owner_account_id=organizer.id),
                EventOwnership(event_id=repeat_event.id,owner_account_id=organizer.id),
                EventOwnership(event_id=outsider.id,owner_account_id=other.id),
            ])
            ticket=main.DemoTicket(event_id=ev.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK")
            db.add(ticket);db.flush()
            event_id,repeat_event_id,ticket_id,guest_id=ev.id,repeat_event.id,ticket.id,guest.id
            db.commit()

        with TestClient(main.app) as client:
            unauth=client.get("/demo/manage/rewards")
            self.assertEqual(unauth.status_code,401,unauth.text)
            denied_before_mfa=client.get("/demo/manage/rewards",headers=auth)
            self.assertEqual(denied_before_mfa.status_code,403,denied_before_mfa.text)
            enroll_mfa(client,auth,pw)
            enroll_mfa(client,other_auth,other_pw)
            view=client.get("/demo/manage/rewards",headers=auth)
            self.assertEqual(view.status_code,200,view.text)
            self.assertNotIn("qr_token",view.text)
            self.assertNotIn("access_token",view.text)
            event_rows={item["id"]:item for item in view.json()["events"]}
            self.assertIn(event_id,event_rows)
            self.assertIn(repeat_event_id,event_rows)
            self.assertEqual(event_rows[event_id]["title"],event_rows[repeat_event_id]["title"])
            self.assertNotEqual(event_rows[event_id]["starts_at"],
                                event_rows[repeat_event_id]["starts_at"])
            self.assertTrue(event_rows[event_id]["starts_at"].startswith(when.date().isoformat()))
            self.assertFalse(any(a["ticket_id"]==ticket_id for a in view.json()["attendees"]))
            other_view=client.get("/demo/manage/rewards",headers=other_auth)
            self.assertNotIn(str(ticket_id)+"_secret",other_view.text)
            self.assertFalse(any(a["ticket_id"]==ticket_id for a in other_view.json()["attendees"]))

            create=client.post("/demo/manage/rewards",headers=auth,json={
                "event_id":event_id,"title":"Guest of the season",
                "description":"Special recognition for visiting.",
                "kind":"badge",
            })
            self.assertEqual(create.status_code,201,create.text)
            reward_id=create.json()["id"]
            forbidden_create=client.post("/demo/manage/rewards",headers=other_auth,json={
                "event_id":event_id,"title":"Stolen organizer reward","kind":"badge",
            })
            self.assertEqual(forbidden_create.status_code,403,forbidden_create.text)
            too_early=client.post(f"/demo/manage/rewards/{reward_id}/grants",
                headers=auth,json={"ticket_id":ticket_id,"note":"Thanks!"})
            self.assertEqual(too_early.status_code,409,too_early.text)
            self.assertEqual(too_early.json()["detail"],"confirmed_checkin_required")
            with SessionLocal() as db:
                ticket=db.get(main.DemoTicket,ticket_id)
                ticket.checked_in_at=datetime.now(timezone.utc)
                db.commit()

            tampered=client.post(f"/demo/manage/rewards/{reward_id}/grants",
                                headers=other_auth,json={"ticket_id":ticket_id})
            self.assertEqual(tampered.status_code,403,tampered.text)
            grant=client.post(f"/demo/manage/rewards/{reward_id}/grants",
                headers=auth,json={"ticket_id":ticket_id,"note":"Verified attendance"})
            self.assertEqual(grant.status_code,201,grant.text)
            grant_id=grant.json()["id"]
            self.assertEqual(grant.json()["ticket_id"],ticket_id)
            self.assertEqual(grant.json()["event_starts_at"],event_rows[event_id]["starts_at"])
            self.assertNotIn("qr_token",grant.text)
            again=client.post(f"/demo/manage/rewards/{reward_id}/grants",
                headers=auth,json={"ticket_id":ticket_id})
            self.assertEqual(again.status_code,409,again.text)
            dashboard=client.get("/api/v1/manage/rewards",headers=auth)
            self.assertEqual(dashboard.status_code,200,dashboard.text)
            self.assertTrue(any(g["id"]==grant_id for g in dashboard.json()["grants"]))

            # Do not leak other people's awards through an authenticated guest session.
            passport=client.get("/demo/me/loyalty",headers=guest_auth)
            self.assertEqual(passport.status_code,200,passport.text)
            self.assertTrue(any(g["id"]==grant_id for g in passport.json()["awards"]))
            other_passport=client.get("/demo/me/loyalty",headers=other_auth)
            self.assertNotIn("qr_token",other_passport.text)

            forbidden_revoke=client.post(f"/demo/manage/rewards/grants/{grant_id}/revoke",
                                          headers=other_auth)
            self.assertEqual(forbidden_revoke.status_code,403,forbidden_revoke.text)
            revoke=client.post(f"/demo/manage/rewards/grants/{grant_id}/revoke",headers=auth)
            self.assertEqual(revoke.status_code,200,revoke.text)
            passport=client.get("/demo/me/loyalty",headers=guest_auth)
            self.assertFalse(any(g["id"]==grant_id for g in passport.json()["awards"]))
            repeat_revoke=client.post(f"/demo/manage/rewards/grants/{grant_id}/revoke",headers=auth)
            self.assertEqual(repeat_revoke.status_code,409)
            with SessionLocal() as db:
                row=db.get(RewardGrant,grant_id)
                self.assertIsNotNone(row.revoked_at)
                self.assertEqual(row.ticket_id,ticket_id)
                self.assertEqual(row.guest_id,guest_id)
                self.assertEqual(db.query(RewardGrant).filter(
                    RewardGrant.reward_id==reward_id,RewardGrant.ticket_id==ticket_id).count(),1)

if __name__=="__main__":
    unittest.main()
