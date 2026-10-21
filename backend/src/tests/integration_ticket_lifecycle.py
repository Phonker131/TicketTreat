"""Free-event E2E: signed Telegram attendees, waitlist, promotion, QR scanning."""
import base64
import os
from unittest.mock import patch
import secrets
import time
import unittest
from datetime import datetime,timedelta,timezone
from decimal import Decimal

from fastapi.testclient import TestClient
if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable test database required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount,WebSession,token_hash
from demo_roles import WebAccountRole,EventOwnership
from demo_account_recovery import VerifiedEmail,now
from demo_auth_security import hash_password
from demo_mfa import _code
from integration_legacy import signed


class QRWaitlistE2E(unittest.TestCase):
    def test_waitlist_promotion_and_authorized_qr_checkin(self):
        with SessionLocal() as db:
            event=main.Event(title="Waitlist and QR E2E",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=4),
                max_participants=1,currency="CZK")
            db.add(event);db.flush()
            guest=main.DemoGuest(access_token=secrets.token_urlsafe(32),
                first_name="Organizer",email=f"organizer-{secrets.token_hex(9)}@example.invalid")
            db.add(guest);db.flush()
            pw="organizer-safe-password-23456"
            account=WebAccount(email=guest.email,first_name="Organizer",last_name="Test",
                guest_id=guest.id,password_hash=hash_password(pw),contact_preference="email")
            db.add(account);db.flush()
            db.add(WebAccountRole(account_id=account.id,role="organizer"))
            db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
            db.add(EventOwnership(event_id=event.id,owner_account_id=account.id))
            access=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=account.id,token_hash=token_hash(access),
                expires_at=now()+timedelta(days=3)))
            db.commit()
            event_id=event.id

        launch_a=signed(secrets.randbelow(10**12)+10**10)
        launch_b=signed(secrets.randbelow(10**12)+10**10)
        with TestClient(main.app) as client:
            a=client.post("/demo/telegram/auth",json={"init_data":launch_a})
            b=client.post("/demo/telegram/auth",json={"init_data":launch_b})
            self.assertEqual(a.status_code,200,a.text)
            self.assertEqual(b.status_code,200,b.text)
            token_a=a.json()["guest"]["access_token"]
            token_b=b.json()["guest"]["access_token"]
            booked=client.post(f"/demo/me/events/{event_id}/checkout",
                json={"language":"en"},
                headers={"X-Telegram-Init-Data":launch_a})
            self.assertEqual(booked.status_code,200,booked.text)
            joined=client.post(f"/demo/me/events/{event_id}/waitlist",
                headers={"X-Telegram-Init-Data":launch_b})
            self.assertEqual(joined.status_code,200,joined.text)
            self.assertEqual(joined.json()["status"],"waiting")
            cancelled=client.delete(
                f"/demo/me/tickets/{booked.json()['ticket']['id']}",
                headers={"X-Telegram-Init-Data":launch_a})
            self.assertEqual(cancelled.status_code,200,cancelled.text)
            self.assertEqual(cancelled.json()["ticket"]["payment_status"],"not_required")
            self.assertIsNotNone(cancelled.json()["promoted_ticket_id"])
            without_auth=client.get("/demo/me/tickets")
            self.assertEqual(without_auth.status_code,401,without_auth.text)
            promoted=client.get("/demo/me/tickets",
                headers={"X-Telegram-Init-Data":launch_b})
            self.assertEqual(promoted.status_code,200,promoted.text)
            self.assertEqual(len(promoted.json()),1)
            qr=promoted.json()[0]["qr_token"]
            self.assertEqual(main.get_registered_count(SessionLocal(),event_id),1)

            headers={"Authorization":"Bearer "+access}
            self.assertEqual(client.post("/demo/manage/check-in",headers=headers,json={"qr_token":qr}).status_code,403)
            setup=client.post("/demo/auth/mfa/start",headers=headers,json={"current_password":pw})
            self.assertEqual(setup.status_code,200,setup.text)
            raw=setup.json()["secret"]
            secret=base64.b32decode(raw+"="*((8-len(raw)%8)%8))
            code=_code(secret,int(time.time())//30)
            ready=client.post("/demo/auth/mfa/confirm",headers=headers,json={"code":code})
            self.assertEqual(ready.status_code,200,ready.text)
            scan=client.post("/demo/manage/check-in",headers=headers,json={"qr_token":qr})
            self.assertEqual(scan.status_code,200,scan.text)
            self.assertEqual(scan.json()["status"],"checked_in")
            self.assertNotIn("qr_token",scan.json()["ticket"])
            self.assertNotIn("access_token",scan.json()["ticket"].get("guest",{}))
            attendees=client.get(f"/demo/manage/events/{event_id}/participants",headers=headers)
            self.assertEqual(attendees.status_code,200,attendees.text)
            for entry in attendees.json()["tickets"]:
                self.assertNotIn("qr_token",entry)
                self.assertNotIn("access_token",entry.get("guest",{}))
            # Organizers may upload a bounded photo gallery without
            # hand-hosted URLs, and all attendees can view the gallery.
            tiny_png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9eUNbXcAAAAASUVORK5CYII="
            uploaded=client.post(f"/demo/manage/events/{event_id}/gallery",
                headers=headers,json={"data_url":"data:image/png;base64,"+tiny_png})
            self.assertEqual(uploaded.status_code,201,uploaded.text)
            picture=client.get(uploaded.json()["url"].removeprefix("/api/gateway"))
            self.assertEqual(picture.status_code,200,picture.text)
            self.assertEqual(picture.headers["content-type"],"image/png")
            event_payload=client.get(f"/events/{event_id}").json()
            self.assertIn(uploaded.json()["url"],event_payload["gallery_urls"])
            self.assertEqual(len(event_payload["uploaded_gallery"]),1)
            deleted=client.delete(f"/demo/manage/events/{event_id}/gallery/{uploaded.json()['id']}",
                headers=headers)
            self.assertEqual(deleted.status_code,200,deleted.text)

            # A verified attendee receives transactional event-change and
            # cancellation notices; unverified addresses are excluded.
            with SessionLocal() as db:
                attendee=db.get(main.DemoGuest,promoted.json()[0]["guest_id"])
                email=f"notice-{secrets.token_hex(8)}@example.invalid"
                attendee.email=email
                account=WebAccount(email=email,first_name="Notified",
                    last_name="Participant",guest_id=attendee.id,
                    password_hash=hash_password("notice-test-password-2026"),
                    contact_preference="email")
                db.add(account);db.flush()
                db.add(VerifiedEmail(account_id=account.id,verified_at=now()))
                db.commit()

            with patch("demo_email.configured",return_value=True):
                changed=client.patch(f"/demo/manage/events/{event_id}",
                    headers=headers,json={"location":"New address for checked-in attendees"})
                self.assertEqual(changed.status_code,200,changed.text)
                stopped=client.post(f"/demo/manage/events/{event_id}/cancel",headers=headers,
                    json={"reason":"Organizer has cancelled this event for technical reasons."})
                self.assertEqual(stopped.status_code,200,stopped.text)
            from demo_email import EmailOutbox,EventNotice,render_email
            with SessionLocal() as db:
                notices=db.query(EventNotice).filter(EventNotice.event_id==event_id).all()
                self.assertEqual({notice.kind for notice in notices},{"change","cancel"})
                messages=db.query(EmailOutbox).filter(EmailOutbox.notice_id.in_([n.id for n in notices])).all()
                self.assertEqual(len(messages),2)
                with patch.dict(os.environ,{"EMAIL_FROM":"tickets@example.invalid"}):
                    for mail in messages:
                        payload=render_email(mail,db)
                        self.assertEqual(payload["to"],[email])
                        self.assertIn("TicketTreat",payload["html"])
                active=db.get(main.DemoTicket,promoted.json()[0]["id"])
                self.assertEqual(active.payment_status,"not_required")
            self.assertIsNotNone(scan.json()["ticket"]["checked_in_at"])
            replay=client.post("/demo/manage/check-in",headers=headers,json={"qr_token":qr})
            self.assertEqual(replay.status_code,409,replay.text)
            invalid=client.post("/demo/manage/check-in",headers=headers,json={"qr_token":"not-a-real-qr"+("x"*14)})
            self.assertEqual(invalid.status_code,404,invalid.text)


if __name__=="__main__":
    unittest.main()
