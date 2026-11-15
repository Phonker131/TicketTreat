"""Promotion security and eligibility on disposable PostgreSQL; no production users."""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing promotions integration tests outside isolated CI PostgreSQL")

import main
from db.session import SessionLocal
from demo_roles import EventOwnership
from demo_mfa import _code
from demo_promotions import Promotion, PromotionClaim, check_automatic
from integration_pilot_ops import account_with_session


def elevate(client, auth, password):
    first = client.post("/demo/auth/mfa/start", headers=auth, json={"current_password": password})
    assert first.status_code == 200, first.text
    b32 = first.json()["secret"]
    raw = base64.b32decode(b32 + "=" * ((8-len(b32)%8)%8))
    result = client.post("/demo/auth/mfa/confirm", headers=auth,
                         json={"code": _code(raw, int(time.time())//30)})
    assert result.status_code == 200, result.text


class PromotionIntegration(unittest.TestCase):
    def test_automatic_signup_event_scope_and_social_review(self):
        start = datetime.now(timezone.utc) - timedelta(minutes=10)
        end = start + timedelta(hours=24)
        with SessionLocal() as db:
            first, _, password, auth = account_with_session(db, "organizer")
            other, _, other_pw, other_auth = account_with_session(db, "organizer")
            guest_account, guest, _, user_auth = account_with_session(db)
            outsider, _, _, outsider_auth = account_with_session(db)
            outsider.created_at = start - timedelta(minutes=1)
            event = main.Event(title="Promo venue " + secrets.token_hex(4),
                               organizer="Amber Events", location="Prague",
                               price=Decimal("0"), currency="CZK",
                               max_participants=20,
                               starts_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=10))
            second = main.Event(title="Other venue " + secrets.token_hex(4),
                                organizer="Other", location="Prague",
                                price=Decimal("0"), currency="CZK",
                                max_participants=20,
                                starts_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=10))
            db.add_all([event, second]);db.flush()
            db.add_all([EventOwnership(event_id=event.id,owner_account_id=first.id),
                        EventOwnership(event_id=second.id,owner_account_id=other.id)])
            ticket = main.DemoTicket(event_id=event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_status="not_required",payment_provider="free",
                payment_amount="0",currency="CZK")
            db.add(ticket)
            db.commit()
            eid, second_id = event.id, second.id
            guest_id = guest.id

        def create_payload(trigger, **change):
            return {"anchor_event_id": eid, "event_id": eid if trigger == "event_booking" else None,
                    "title": "Amber VIP 24h", "description": "Pilot offer",
                    "trigger": trigger, "reward_kind": "vip_perk",
                    "reward_title": "Amber VIP", "reward_details": "Organizer promotional VIP perk",
                    "starts_at": start.isoformat(), "ends_at": end.isoformat(),
                    "benefit_expires_at": (end + timedelta(days=30)).isoformat(),
                    "instagram_url": "https://www.instagram.com/amber_events/" if trigger == "instagram_follow" else "",
                    **change}

        with TestClient(main.app) as client:
            self.assertEqual(client.get("/demo/manage/promotions").status_code,401)
            self.assertEqual(client.get("/demo/manage/promotions", headers=auth).status_code,403)
            elevate(client, auth, password)
            elevate(client, other_auth, other_pw)
            invalid = create_payload("account_signup", ends_at=start.isoformat())
            self.assertEqual(client.post("/demo/manage/promotions",headers=auth,json=invalid).status_code,422)
            not_owned = create_payload("account_signup", anchor_event_id=second_id)
            self.assertEqual(client.post("/demo/manage/promotions",headers=auth,json=not_owned).status_code,403)
            signup = client.post("/demo/manage/promotions",headers=auth,
                                 json=create_payload("account_signup"))
            self.assertEqual(signup.status_code,201,signup.text)
            campaign_id = signup.json()["id"]
            self.assertEqual(signup.json()["status"],"draft")
            self.assertEqual(client.get("/demo/promotions").json()["campaigns"],[])
            forbidden = client.post(f"/demo/manage/promotions/{campaign_id}/status",
                            headers=other_auth,json={"status":"active"})
            self.assertEqual(forbidden.status_code,403,forbidden.text)
            active = client.post(f"/demo/manage/promotions/{campaign_id}/status",
                         headers=auth,json={"status":"active"})
            self.assertEqual(active.status_code,200,active.text)
            self.assertTrue(active.json()["is_live"])
            self.assertEqual(client.get("/demo/manage/promotions",headers=auth).json()["campaigns"][0]["eligible_count"]>=1,True)
            theirs = client.get("/demo/me/promotions",headers=user_auth)
            self.assertEqual(theirs.status_code,200,theirs.text)
            self.assertEqual(theirs.json()["campaigns"][0]["participation"],"earned")
            excluded = client.get("/demo/me/promotions",headers=outsider_auth)
            self.assertEqual(excluded.status_code,200,excluded.text)
            self.assertEqual(excluded.json()["campaigns"][0]["participation"],"not_eligible")
            guest_passport = client.get("/demo/me/loyalty",headers=user_auth)
            # Guest endpoint and account endpoint are two distinct auth channels.
            # Directly inspect the same server-side source of the guest passport.
            from demo_loyalty import passport_for
            with SessionLocal() as db:
                wallet=passport_for(db,guest_id,main)
                self.assertTrue(any(p["id"]==campaign_id for p in wallet["campaign_perks"]))
                self.assertEqual(wallet["total_lifetime_visits"],0)
            self.assertIn(guest_passport.status_code,(200,401))

            booking = client.post("/demo/manage/promotions",headers=auth,
                                   json=create_payload("event_booking",title="Booking reward"))
            self.assertEqual(booking.status_code,201,booking.text)
            self.assertEqual(client.post(f"/demo/manage/promotions/{booking.json()['id']}/status",
                 headers=auth,json={"status":"active"}).status_code,200)
            earned = client.get("/demo/me/promotions",headers=user_auth).json()["campaigns"]
            self.assertTrue(any(p["id"]==booking.json()["id"] and p["participation"]=="earned" for p in earned))

            ig = client.post("/demo/manage/promotions",headers=auth,
                              json=create_payload("instagram_follow",title="Follow campaign"))
            self.assertEqual(ig.status_code,201,ig.text)
            ig_id=ig.json()["id"]
            self.assertEqual(client.post(f"/demo/manage/promotions/{ig_id}/status",
                 headers=auth,json={"status":"active"}).status_code,200)
            invalid_ig=client.post(f"/demo/me/promotions/{ig_id}/claim",headers=user_auth,
                                   json={"instagram_username":"username with spaces"})
            self.assertEqual(invalid_ig.status_code,422,invalid_ig.text)
            claimed=client.post(f"/demo/me/promotions/{ig_id}/claim",headers=user_auth,
                                json={"instagram_username":"amber.fan"})
            self.assertEqual(claimed.status_code,201,claimed.text)
            self.assertEqual(client.post(f"/demo/me/promotions/{ig_id}/claim",headers=user_auth,
                 json={"instagram_username":"amber.fan"}).status_code,409)
            queue=client.get(f"/demo/manage/promotions/{ig_id}/claims",headers=auth)
            self.assertEqual(queue.status_code,200,queue.text)
            claim_id=queue.json()["claims"][0]["id"]
            self.assertEqual(queue.json()["claims"][0]["status"],"pending")
            self.assertEqual(client.get(f"/demo/manage/promotions/{ig_id}/claims",headers=other_auth).status_code,403)
            self.assertEqual(client.post(f"/demo/manage/promotions/{ig_id}/claims/{claim_id}/review",
                 headers=other_auth,json={"approve":True}).status_code,403)
            approved=client.post(f"/demo/manage/promotions/{ig_id}/claims/{claim_id}/review",
                                headers=auth,json={"approve":True})
            self.assertEqual(approved.status_code,200,approved.text)
            self.assertEqual(approved.json()["status"],"approved")
            self.assertEqual(client.post(f"/demo/manage/promotions/{ig_id}/claims/{claim_id}/review",
                 headers=auth,json={"approve":True}).status_code,409)
            with SessionLocal() as db:
                wallet=passport_for(db,guest_id,main)
                self.assertTrue(any(p["id"]==ig_id for p in wallet["campaign_perks"]))
            self.assertEqual(client.post(f"/demo/manage/promotions/{ig_id}/status",
                 headers=auth,json={"status":"paused"}).status_code,200)
            with SessionLocal() as db:
                self.assertFalse(any(p["id"]==ig_id for p in passport_for(db,guest_id,main)["campaign_perks"]))
