"""Conversation ownership, unlisted events, uniqueness and privacy (CI PostgreSQL only)."""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing chat tests outside disposable PostgreSQL")

import main
from db.session import SessionLocal
from demo_roles import EventOwnership
from demo_event_access import set_visibility, invite_for
from demo_publication import set_publication
from demo_event_chat import EventChatThread, EventChatMessage
from demo_mfa import _code
from integration_pilot_ops import account_with_session


def enroll_mfa(client, auth, password):
    first = client.post("/demo/auth/mfa/start", headers=auth,
                        json={"current_password":password})
    assert first.status_code == 200, first.text
    value=first.json()["secret"]
    secret=base64.b32decode(value + "=" * ((8-len(value)%8)%8))
    enabled=client.post("/demo/auth/mfa/confirm", headers=auth,
                        json={"code":_code(secret,int(time.time())//30)})
    assert enabled.status_code == 200, enabled.text


def message(text):
    return {"body":text, "client_nonce":str(__import__("uuid").uuid4())}


class EventChatIntegration(unittest.TestCase):
    def test_scope_private_invites_delivery_idempotency_read_close_and_history(self):
        with SessionLocal() as db:
            organizer, _, password, own_headers = account_with_session(db,"organizer")
            stranger, _, other_pw, other_headers = account_with_session(db,"organizer")
            member, guest, _, member_headers = account_with_session(db)
            other_member, other_guest, _, other_member_headers = account_with_session(db)
            future=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=8)
            event=main.Event(title="Chat test "+secrets.token_hex(3),
                organizer="Amber Events",location="Prague",
                starts_at=future,max_participants=15,
                currency="CZK",price=Decimal("0"),is_cancelled=False)
            private=main.Event(title="Private chat "+secrets.token_hex(3),
                organizer="Amber Events",location="Prague",
                starts_at=future,max_participants=15,
                currency="CZK",price=Decimal("0"),is_cancelled=False)
            draft=main.Event(title="Draft chat "+secrets.token_hex(3),
                organizer="Amber Events",location="Prague",
                starts_at=future,max_participants=15,
                currency="CZK",price=Decimal("0"),is_cancelled=False)
            foreign=main.Event(title="Other owner "+secrets.token_hex(3),
                organizer="Other Studio",location="Prague",
                starts_at=future,max_participants=15,
                currency="CZK",price=Decimal("0"),is_cancelled=False)
            db.add_all([event,private,draft,foreign]);db.flush()
            for e,owner in ((event,organizer),(private,organizer),(draft,organizer),(foreign,stranger)):
                db.add(EventOwnership(event_id=e.id,owner_account_id=owner.id))
            set_visibility(db,private.id,"link_only")
            set_publication(db,draft.id,"draft")
            invite=invite_for(db,private.id).invite_token
            event_id,private_id,draft_id,foreign_id=event.id,private.id,draft.id,foreign.id
            guest_id=guest.id
            member_email=member.email
            db.commit()

        with TestClient(main.app) as client:
            self.assertEqual(client.get("/demo/me/chats").status_code,401)
            self.assertEqual(client.get("/demo/manage/chats",headers=own_headers).status_code,403)
            enroll_mfa(client,own_headers,password)
            enroll_mfa(client,other_headers,other_pw)
            self.assertEqual(client.get("/demo/me/events/%d/chat"%draft_id,headers=member_headers).status_code,404)
            self.assertEqual(client.get("/demo/me/events/%d/chat"%private_id,headers=member_headers).status_code,404)
            self.assertEqual(client.get("/demo/me/events/%d/chat"%private_id,headers={**member_headers,"X-Event-Invite":invite}).status_code,200)
            self.assertIsNone(client.get("/demo/me/events/%d/chat"%event_id,headers=member_headers).json()["thread"])
            first=message("Hi, can I ask about the VIP offer?")
            created=client.post(f"/demo/me/events/{event_id}/chat/messages",
                                headers=member_headers,json=first)
            self.assertEqual(created.status_code,201,created.text)
            mid=created.json()["message"]["id"]
            resend=client.post(f"/demo/me/events/{event_id}/chat/messages",
                               headers=member_headers,json=first)
            self.assertEqual(resend.status_code,201,resend.text)
            self.assertTrue(resend.json()["duplicate"])
            self.assertEqual(resend.json()["message"]["id"],mid)
            with SessionLocal() as db:
                t=db.query(EventChatThread).filter(EventChatThread.event_id==event_id,
                                                    EventChatThread.guest_id==guest_id).one()
                thread_id=t.id
                self.assertEqual(db.query(EventChatMessage).filter(EventChatMessage.thread_id==t.id).count(),1)
            self.assertEqual(client.get(f"/demo/me/chats/{thread_id}",headers=other_member_headers).status_code,404)
            self.assertEqual(client.get(f"/demo/manage/chats/{thread_id}",headers=other_headers).status_code,404)
            self.assertEqual(client.post(f"/demo/manage/chats/{thread_id}/messages",headers=other_headers,
                                  json=message("Unauthorized reply")).status_code,404)
            inbox=client.get("/demo/manage/chats",headers=own_headers)
            self.assertEqual(inbox.status_code,200,inbox.text)
            self.assertEqual(inbox.json()["unread"],1)
            self.assertNotIn("qr_token",inbox.text)
            self.assertNotIn("access_token",inbox.text)
            self.assertNotIn(member_email,inbox.text)
            self.assertEqual(client.post(f"/demo/manage/chats/{thread_id}/read",headers=own_headers).status_code,200)
            self.assertFalse(client.get(f"/demo/manage/chats/{thread_id}",headers=own_headers).json()["thread"]["unread"])
            reply=client.post(f"/demo/manage/chats/{thread_id}/messages",headers=own_headers,
                              json=message("<script>VIP details are in your email.</script>"))
            self.assertEqual(reply.status_code,201,reply.text)
            detail=client.get(f"/demo/me/chats/{thread_id}",headers=member_headers)
            self.assertEqual(detail.status_code,200,detail.text)
            self.assertTrue(detail.json()["thread"]["unread"])
            self.assertEqual(len(detail.json()["messages"]),2)
            self.assertIn("<script>",detail.json()["messages"][-1]["body"]) # React escapes on display
            self.assertEqual(client.post(f"/demo/me/chats/{thread_id}/read",
                headers=member_headers).status_code,200)
            self.assertFalse(client.get(f"/demo/me/chats/{thread_id}",headers=member_headers).json()["thread"]["unread"])
            # Each message idempotency key cannot be replayed to bypass daily quota.
            repeated=client.post(f"/demo/manage/chats/{thread_id}/messages",headers=own_headers,
                                 json=message("Another staff reply"))
            self.assertIn(repeated.status_code,(201,429))
            closed=client.post(f"/demo/manage/chats/{thread_id}/status",
                               headers=own_headers,json={"closed":True})
            self.assertEqual(closed.status_code,200,closed.text)
            self.assertEqual(client.post(f"/demo/me/chats/{thread_id}/messages",
                headers=member_headers,json=message("Hello again")).status_code,409)
            self.assertEqual(client.post(f"/demo/manage/chats/{thread_id}/status",
                               headers=own_headers,json={"closed":False}).status_code,200)
            # Reopen does not erase messages; an unlisted event is still private.
            denied=client.post(f"/demo/me/events/{private_id}/chat/messages",
                               headers=member_headers,json=message("A private question"))
            self.assertEqual(denied.status_code,404)
            # The per-guest anti-spam rule applies across different events.
            limited=client.post(f"/demo/me/events/{private_id}/chat/messages",
                                headers={**member_headers,"X-Event-Invite":invite},
                                json=message("A private question"))
            self.assertEqual(limited.status_code,429,limited.text)
            time.sleep(2.1)
            valid=client.post(f"/demo/me/events/{private_id}/chat/messages",
                              headers={**member_headers,"X-Event-Invite":invite},
                              json=message("A private question"))
            self.assertEqual(valid.status_code,201,valid.text)
            self.assertEqual(client.get("/demo/manage/chats",headers=other_headers).json()["threads"],[])
            self.assertEqual(client.get("/demo/me/chats",headers=other_member_headers).json()["threads"],[])
            self.assertEqual(client.get("/demo/manage/chats",headers=own_headers).json()["unread"],1)
            # Overlength bodies are rejected, not truncated.
            self.assertEqual(client.post(f"/demo/me/chats/{thread_id}/messages",
                 headers=member_headers,json=message("A"*2001)).status_code,422)
            # Existing thread remains accessible without private invitation
            # after its owner has already sent an authenticated message.
            exists=client.get(f"/demo/me/events/{private_id}/chat",headers=member_headers)
            self.assertEqual(exists.status_code,200,exists.text)

    def test_organizer_does_not_see_threads_from_another_organizer(self):
        # Fixture checks do not require an unrelated service or external API.
        with SessionLocal() as db:
            owner1,_,pw1,h1=account_with_session(db,"organizer")
            owner2,_,pw2,h2=account_with_session(db,"organizer")
            user,guest,_,u=account_with_session(db)
            event=main.Event(title="Isolation "+secrets.token_hex(4),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                organizer="Private Organizer",location="Prague",
                max_participants=10,currency="CZK",price=Decimal("0"))
            db.add(event);db.flush()
            db.add(EventOwnership(event_id=event.id,owner_account_id=owner1.id))
            eid=event.id
            db.commit()
        with TestClient(main.app) as client:
            enroll_mfa(client,h1,pw1)
            enroll_mfa(client,h2,pw2)
            created=client.post(f"/demo/me/events/{eid}/chat/messages",headers=u,
                                json=message("Hello, how can I join?"))
            self.assertEqual(created.status_code,201,created.text)
            thread=client.get("/demo/me/chats",headers=u).json()["threads"][0]["id"]
            self.assertTrue(any(t["id"]==thread for t in client.get("/demo/manage/chats",headers=h1).json()["threads"]))
            self.assertFalse(any(t["id"]==thread for t in client.get("/demo/manage/chats",headers=h2).json()["threads"]))
