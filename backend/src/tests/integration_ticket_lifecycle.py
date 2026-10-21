"""Free-event E2E: signed Telegram attendees, waitlist, promotion, QR scanning."""
import base64
import os
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
            booked=client.post(f"/demo/events/{event_id}/checkout",
                json={"guest_token":token_a,"language":"en"},
                headers={"X-Telegram-Init-Data":launch_a})
            self.assertEqual(booked.status_code,200,booked.text)
            joined=client.post(f"/demo/events/{event_id}/waitlist",
                json={"guest_token":token_b},headers={"X-Telegram-Init-Data":launch_b})
            self.assertEqual(joined.status_code,200,joined.text)
            self.assertEqual(joined.json()["status"],"waiting")
            cancelled=client.delete(
                f"/demo/guests/{token_a}/tickets/{booked.json()['ticket']['id']}",
                headers={"X-Telegram-Init-Data":launch_a})
            self.assertEqual(cancelled.status_code,200,cancelled.text)
            self.assertIsNotNone(cancelled.json()["promoted_ticket_id"])
            promoted=client.get(f"/demo/guests/{token_b}/tickets",
                headers={"X-Telegram-Init-Data":launch_b})
            self.assertEqual(promoted.status_code,200,promoted.text)
            self.assertEqual(len(promoted.json()),1)
            qr=promoted.json()[0]["qr_token"]
            self.assertEqual(main.get_registered_count(SessionLocal(),event_id),1)

            headers={"Authorization":"Bearer "+access}
            self.assertEqual(client.post(f"/demo/manage/check-in/{qr}",headers=headers).status_code,403)
            setup=client.post("/demo/auth/mfa/start",headers=headers,json={"current_password":pw})
            self.assertEqual(setup.status_code,200,setup.text)
            raw=setup.json()["secret"]
            secret=base64.b32decode(raw+"="*((8-len(raw)%8)%8))
            code=_code(secret,int(time.time())//30)
            ready=client.post("/demo/auth/mfa/confirm",headers=headers,json={"code":code})
            self.assertEqual(ready.status_code,200,ready.text)
            scan=client.post(f"/demo/manage/check-in/{qr}",headers=headers)
            self.assertEqual(scan.status_code,200,scan.text)
            self.assertEqual(scan.json()["status"],"checked_in")
            self.assertIsNotNone(scan.json()["ticket"]["checked_in_at"])
            replay=client.post(f"/demo/manage/check-in/{qr}",headers=headers)
            self.assertEqual(replay.status_code,200,replay.text)
            invalid=client.post("/demo/manage/check-in/not-a-real-qr",headers=headers)
            self.assertEqual(invalid.status_code,404,invalid.text)


if __name__=="__main__":
    unittest.main()
