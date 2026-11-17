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
from demo_loyalty_benefits import OrganizerLoyaltyAlias
from demo_loyalty import attendance_counts
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
    def test_reviewed_legacy_organizer_alias_unifies_only_matching_studio(self):
        """One business can have two historic publishers; same-name strangers stay separate."""
        with SessionLocal() as db:
            current,_,current_pw,current_auth=account_with_session(db,"organizer")
            old,_,old_pw,old_auth=account_with_session(db,"organizer")
            stranger,_,stranger_pw,stranger_auth=account_with_session(db,"organizer")
            _attendee,guest,_,guest_auth=account_with_session(db)
            owners=[current.id,old.id,old.id,stranger.id]
            labels=["Amber Events","Amber Events","Scentino","Amber Events"]
            now=datetime.now(timezone.utc)
            events=[]
            for index,(owner_id,label) in enumerate(zip(owners,labels)):
                event=main.Event(title=f"Legacy org test {secrets.token_hex(6)}",
                                 organizer=label,
                                 starts_at=(now-timedelta(days=2+index)).replace(tzinfo=None),
                                 price=Decimal("0"),currency="CZK",max_participants=20,
                                 is_cancelled=False)
                db.add(event);db.flush()
                db.add(EventOwnership(event_id=event.id,owner_account_id=owner_id))
                db.add(main.DemoTicket(event_id=event.id,guest_id=guest.id,
                    qr_token=secrets.token_urlsafe(32),ticket_status="active",
                    checked_in_at=now-timedelta(hours=1+index),payment_status="not_required",
                    payment_provider="free",payment_amount="0",currency="CZK"))
                events.append(event)
            db.add(OrganizerLoyaltyAlias(owner_account_id=old.id,
                    organizer_name_key="amber events",canonical_owner_account_id=current.id))
            db.commit()
            current_id,old_id,stranger_id,guest_id=current.id,old.id,stranger.id,guest.id

        with SessionLocal() as db:
            self.assertEqual(attendance_counts(db,current_id,[guest_id],main=main)[guest_id],2)
            self.assertEqual(attendance_counts(db,old_id,[guest_id],main=main)[guest_id],1)
            self.assertEqual(attendance_counts(db,stranger_id,[guest_id],main=main)[guest_id],1)
        with TestClient(main.app) as client:
            for header,password in ((current_auth,current_pw),(old_auth,old_pw),
                                    (stranger_auth,stranger_pw)):
                enroll_mfa(client,header,password)
            current_studios=client.get("/demo/manage/loyalty/tiers",headers=current_auth)
            self.assertEqual(current_studios.status_code,200,current_studios.text)
            self.assertEqual([(r["owner_account_id"],r["name"]) for r in current_studios.json()["organizers"]],
                             [(current_id,"Amber Events")])
            old_studios=client.get("/demo/manage/loyalty/tiers",headers=old_auth)
            self.assertEqual(old_studios.status_code,200,old_studios.text)
            self.assertEqual({(r["owner_account_id"],r["name"]) for r in old_studios.json()["organizers"]},
                             {(current_id,"Amber Events"),(old_id,"Scentino")})
            stranger_studios=client.get("/demo/manage/loyalty/tiers",headers=stranger_auth)
            self.assertEqual(stranger_studios.status_code,200,stranger_studios.text)
            self.assertEqual([r["owner_account_id"] for r in stranger_studios.json()["organizers"]],
                             [stranger_id])
            passport=client.get("/demo/me/loyalty",headers=guest_auth)
            self.assertEqual(passport.status_code,200,passport.text)
            studio_visits={(r["organizer_id"],r["organizer_name"]):r["season_visits"]
                           for r in passport.json()["studios"]}
            self.assertEqual(studio_visits[(current_id,"Amber Events")],2)
            self.assertEqual(studio_visits[(old_id,"Scentino")],1)
            self.assertEqual(studio_visits[(stranger_id,"Amber Events")],1)

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
            organizer_id=organizer.id
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
            unauthorized_edit=client.patch(f"/demo/manage/rewards/{reward_id}",json={
                "title":"Altered award","description":"","kind":"badge","active":True,
            })
            self.assertEqual(unauthorized_edit.status_code,401,unauthorized_edit.text)
            forbidden_edit=client.patch(f"/demo/manage/rewards/{reward_id}",headers=other_auth,json={
                "title":"Altered award","description":"","kind":"badge","active":True,
            })
            self.assertEqual(forbidden_edit.status_code,403,forbidden_edit.text)
            bad_title=client.patch(f"/demo/manage/rewards/{reward_id}",headers=auth,json={
                "title":"  ","description":"","kind":"badge","active":True,
            })
            self.assertEqual(bad_title.status_code,422,bad_title.text)
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
            edited=client.patch(f"/api/v1/manage/rewards/{reward_id}",headers=auth,json={
                "title":"VIP attendance recognition","description":"Thank you for joining!",
                "kind":"recognition","active":False,
            })
            self.assertEqual(edited.status_code,200,edited.text)
            self.assertFalse(edited.json()["active"])
            blocked=client.post(f"/demo/manage/rewards/{reward_id}/grants",headers=auth,
                                json={"ticket_id":ticket_id})
            self.assertEqual(blocked.status_code,404,blocked.text)
            # Archiving prevents new grants, but the guest keeps the old award.
            passport=client.get("/demo/me/loyalty",headers=guest_auth)
            self.assertTrue(any(g["id"]==grant_id and g["title"]=="VIP attendance recognition"
                                for g in passport.json()["awards"]))
            restored=client.patch(f"/demo/manage/rewards/{reward_id}",headers=auth,json={
                "title":"VIP attendance recognition","description":"Thank you for joining!",
                "kind":"recognition","active":True,
            })
            self.assertEqual(restored.status_code,200,restored.text)
            self.assertTrue(restored.json()["active"])
            # Organization-wide loyalty tiers are separate from manual event
            # awards. An organizer can configure own bilingual tier benefits.
            tiers=client.get("/api/v1/manage/loyalty/tiers",headers=auth)
            self.assertEqual(tiers.status_code,200,tiers.text)
            organizer_tiers=next(o for o in tiers.json()["organizers"]
                                 if o["owner_account_id"]==organizer_id)
            self.assertEqual([b["required_visits"] for b in organizer_tiers["tiers"]],[0,3,6,12])
            saved_tier=client.put(f"/api/v1/manage/loyalty/tiers/{organizer_id}/regular",headers=auth,json={
                "label_en":"Priority booking queue","label_cs":"Přednostní pořadník",
                "description_en":"For verified repeat visitors", "description_cs":"Pro pravidelné návštěvníky",
                "priority_enabled":False,
            })
            self.assertEqual(saved_tier.status_code,200,saved_tier.text)
            self.assertFalse(saved_tier.json()["enabled"])
            stranger=client.put(f"/demo/manage/loyalty/tiers/{organizer_id}/regular",headers=other_auth,json={
                "label_en":"Hijacked program","label_cs":"Cizí program","priority_enabled":True,
            })
            self.assertEqual(stranger.status_code,403,stranger.text)
            fake_early=client.put(f"/demo/manage/loyalty/tiers/{organizer_id}/vip",headers=auth,json={
                "label_en":"VIP early booking","label_cs":"VIP předčasná rezervace",
                "priority_enabled":True,
            })
            self.assertEqual(fake_early.status_code,422,fake_early.text)
            after=client.get("/demo/me/loyalty",headers=guest_auth)
            owned_studio=next(s for s in after.json()["studios"]
                              if s["organizer_id"]==organizer_id)
            self.assertEqual(owned_studio["tier_rewards"][1]["label_en"],"Priority booking queue")
            self.assertEqual(owned_studio["tier_rewards"][1]["description_en"],"For verified repeat visitors")
            self.assertFalse(owned_studio["tier_rewards"][1]["enabled"])
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
