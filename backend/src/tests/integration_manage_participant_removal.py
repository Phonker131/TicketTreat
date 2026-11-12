"""Organizer-controlled participant removal: scoped, audited, no historical deletion.

Runs exclusively against the disposable tickettreat_ci PostgreSQL database.
"""
import base64
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing participant removal tests outside disposable CI DB")

from fastapi.testclient import TestClient
import main
from db.session import SessionLocal
from demo_roles import EventOwnership, EventModerationLog
from demo_mfa import _code
from integration_pilot_ops import account_with_session


def unlock_mfa(client, headers, password):
    start=client.post("/demo/auth/mfa/start",headers=headers,
                      json={"current_password":password})
    assert start.status_code==200,start.text
    secret=start.json()["secret"]
    raw=base64.b32decode(secret+"="*((8-len(secret)%8)%8))
    ok=client.post("/demo/auth/mfa/confirm",headers=headers,
                   json={"code":_code(raw,int(time.time())//30)})
    assert ok.status_code==200,ok.text


class OrganizerRemovalIntegration(unittest.TestCase):
    def test_scoped_ticket_and_waitlist_remove_preserves_checked_in_and_promotes(self):
        with SessionLocal() as db:
            owner,_,owner_pw,headers=account_with_session(db,"organizer")
            other,_,other_pw,other_headers=account_with_session(db,"organizer")
            _,guest,_,_=account_with_session(db)
            _,checked,_,_=account_with_session(db)
            _,next_guest,_,_=account_with_session(db)
            _,last_guest,_,_=account_with_session(db)
            future=(datetime.now(timezone.utc)+timedelta(days=4)).replace(tzinfo=None)
            event=main.Event(title="Removal test "+secrets.token_hex(4),price=Decimal("0"),
                             starts_at=future,max_participants=2,currency="CZK",
                             is_cancelled=False)
            other_event=main.Event(title="Other owner event "+secrets.token_hex(4),
                             price=Decimal("0"),starts_at=future,
                             max_participants=3,currency="CZK",is_cancelled=False)
            db.add_all([event,other_event]);db.flush()
            event_id=event.id
            other_event_id=other_event.id
            db.add_all([EventOwnership(event_id=event.id,owner_account_id=owner.id),
                        EventOwnership(event_id=other_event.id,owner_account_id=other.id)])
            active=main.DemoTicket(event_id=event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_provider="free",payment_status="not_required",
                payment_amount="0",currency="CZK")
            scanned=main.DemoTicket(event_id=event.id,guest_id=checked.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                checked_in_at=datetime.now(timezone.utc)-timedelta(hours=1),
                payment_provider="free",payment_status="not_required",
                payment_amount="0",currency="CZK")
            outside=main.DemoTicket(event_id=other_event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_provider="free",payment_status="not_required",
                payment_amount="0",currency="CZK")
            first=main.DemoWaitlist(event_id=event.id,guest_id=next_guest.id,status="waiting")
            last=main.DemoWaitlist(event_id=event.id,guest_id=last_guest.id,status="waiting")
            db.add_all([active,scanned,outside,first,last]);db.flush()
            active_id,scanned_id,outside_id=active.id,scanned.id,outside.id
            first_id,last_id=first.id,last.id
            next_guest_id=next_guest.id
            old_qr=active.qr_token
            scanned_at=scanned.checked_in_at
            db.commit()
        url=f"/demo/manage/events/{event_id}/participants"
        remove_body={"reason":"Duplicate test enrollment, remove this place"}
        with TestClient(main.app) as client:
            anonymous=client.post(f"{url}/{active_id}/remove",json=remove_body)
            self.assertEqual(anonymous.status_code,401,anonymous.text)
            prior=client.post(f"{url}/{active_id}/remove",headers=headers,json=remove_body)
            self.assertEqual(prior.status_code,403,prior.text)
            unlock_mfa(client,headers,owner_pw)
            unlock_mfa(client,other_headers,other_pw)

            wrong_owner=client.post(f"{url}/{active_id}/remove",headers=other_headers,json=remove_body)
            self.assertEqual(wrong_owner.status_code,403,wrong_owner.text)
            wrong_event=client.post(f"{url}/{outside_id}/remove",headers=headers,json=remove_body)
            self.assertEqual(wrong_event.status_code,404,wrong_event.text)
            short=client.post(f"{url}/{active_id}/remove",headers=headers,json={"reason":"bad"})
            self.assertEqual(short.status_code,422,short.text)
            checkin=client.post(f"{url}/{scanned_id}/remove",headers=headers,json=remove_body)
            self.assertEqual(checkin.status_code,409,checkin.text)
            self.assertEqual(checkin.json()["detail"],"checked_in_ticket_cannot_be_removed")

            removed=client.post(f"{url}/{active_id}/remove",headers=headers,json=remove_body)
            self.assertEqual(removed.status_code,200,removed.text)
            self.assertEqual(removed.json()["status"],"removed")
            self.assertIsNotNone(removed.json()["promoted_ticket_id"])
            repeated=client.post(f"{url}/{active_id}/remove",headers=headers,json=remove_body)
            self.assertEqual(repeated.status_code,409,repeated.text)
            self.assertEqual(repeated.json()["detail"],"ticket_not_active")

            withdraw=client.post(f"/demo/manage/events/{event_id}/waitlist/{last_id}/remove",
                headers=headers,json={"reason":"Guest asked organizer to remove waitlist"})
            self.assertEqual(withdraw.status_code,200,withdraw.text)
            self.assertEqual(withdraw.json()["status"],"removed")
            withdraw_again=client.post(f"/demo/manage/events/{event_id}/waitlist/{last_id}/remove",
                headers=headers,json={"reason":"Guest asked organizer to remove waitlist"})
            self.assertEqual(withdraw_again.status_code,409,withdraw_again.text)

        with SessionLocal() as db:
            ticket=db.get(main.DemoTicket,active_id)
            self.assertEqual(ticket.ticket_status,"cancelled")
            self.assertEqual(ticket.qr_token,old_qr)
            self.assertIsNotNone(ticket.cancelled_at)
            self.assertEqual(ticket.payment_status,"not_required")
            self.assertEqual(db.get(main.DemoTicket,scanned_id).checked_in_at,scanned_at)
            self.assertEqual(db.get(main.DemoTicket,outside_id).ticket_status,"active")
            first_entry=db.get(main.DemoWaitlist,first_id)
            last_entry=db.get(main.DemoWaitlist,last_id)
            self.assertEqual(first_entry.status,"promoted")
            self.assertEqual(last_entry.status,"cancelled")
            promoted=db.query(main.DemoTicket).filter(
                main.DemoTicket.event_id==event_id,
                main.DemoTicket.guest_id==next_guest_id).one()
            self.assertEqual(promoted.ticket_status,"active")
            self.assertEqual(main.get_registered_count(db,event_id),2)
            log=db.query(EventModerationLog).filter(
                EventModerationLog.event_id==event_id,
                EventModerationLog.action.in_(["remove_guest","remove_waiting"])
            ).all()
            self.assertEqual(len(log),2)
            self.assertIn(f"ticket:{active_id}",next(x.details for x in log if x.action=="remove_guest"))
            self.assertIn(f"entry:{last_id}",next(x.details for x in log if x.action=="remove_waiting"))


    def test_organizer_direct_payment_requires_confirmation_but_not_fake_refund(self):
        with SessionLocal() as db:
            owner,_,password,headers=account_with_session(db,"organizer")
            _,guest,_,_=account_with_session(db)
            _,checked,_,_=account_with_session(db)
            _,unknown_guest,_,_=account_with_session(db)
            future=(datetime.now(timezone.utc)+timedelta(days=4)).replace(tzinfo=None)
            event=main.Event(title="External payment cancellation "+secrets.token_hex(4),
                price=Decimal("250"),starts_at=future,max_participants=3,
                currency="CZK",is_cancelled=False)
            db.add(event);db.flush()
            db.add(EventOwnership(event_id=event.id,owner_account_id=owner.id))
            paid=main.DemoTicket(event_id=event.id,guest_id=guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_provider="organizer_direct",payment_status="paid",
                payment_amount="250",currency="CZK")
            scanned=main.DemoTicket(event_id=event.id,guest_id=checked.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_provider="organizer_direct",payment_status="paid",
                payment_amount="250",currency="CZK",
                checked_in_at=datetime.now(timezone.utc)-timedelta(hours=1))
            unknown_provider=main.DemoTicket(event_id=event.id,guest_id=unknown_guest.id,
                qr_token=secrets.token_urlsafe(32),ticket_status="active",
                payment_provider="external_psp",payment_status="paid",
                payment_amount="250",currency="CZK")
            db.add_all([paid,scanned,unknown_provider]);db.flush()
            event_id,ticket_id,checked_id,unknown_id=event.id,paid.id,scanned.id,unknown_provider.id
            original_qr=paid.qr_token
            db.commit()

        url=f"/demo/manage/events/{event_id}/participants/{ticket_id}/remove"
        body={"reason":"Organizer cancelled a paid reservation after manual review"}
        with TestClient(main.app) as client:
            unlock_mfa(client,headers,password)
            no_review=client.post(url,headers=headers,json=body)
            self.assertEqual(no_review.status_code,409,no_review.text)
            self.assertEqual(no_review.json()["detail"],
                "manual_payment_review_confirmation_required")
            still_scanned=client.post(
                f"/demo/manage/events/{event_id}/participants/{checked_id}/remove",
                headers=headers,json={**body,"manual_payment_review_confirmed":True})
            self.assertEqual(still_scanned.status_code,409,still_scanned.text)
            self.assertEqual(still_scanned.json()["detail"],
                "checked_in_ticket_cannot_be_removed")
            unsupported=client.post(
                f"/demo/manage/events/{event_id}/participants/{unknown_id}/remove",
                headers=headers,json={**body,"manual_payment_review_confirmed":True})
            self.assertEqual(unsupported.status_code,409,unsupported.text)
            self.assertEqual(unsupported.json()["detail"],"payment_requires_manual_review")
            result=client.post(url,headers=headers,
                json={**body,"manual_payment_review_confirmed":True})
            self.assertEqual(result.status_code,200,result.text)
            self.assertEqual(result.json()["status"],"removed")
            self.assertTrue(result.json()["manual_payment_followup_required"])
            repeated=client.post(url,headers=headers,
                json={**body,"manual_payment_review_confirmed":True})
            self.assertEqual(repeated.status_code,409,repeated.text)

        with SessionLocal() as db:
            ticket=db.get(main.DemoTicket,ticket_id)
            self.assertEqual(ticket.ticket_status,"cancelled")
            self.assertIsNotNone(ticket.cancelled_at)
            self.assertEqual(ticket.qr_token,original_qr)
            # Historical payment remains recorded as paid: no automated refund.
            self.assertEqual(ticket.payment_provider,"organizer_direct")
            self.assertEqual(ticket.payment_status,"paid")
            self.assertEqual(ticket.payment_amount,"250")
            self.assertEqual(db.get(main.DemoTicket,checked_id).ticket_status,"active")
            self.assertEqual(db.get(main.DemoTicket,unknown_id).ticket_status,"active")
            action=db.query(EventModerationLog).filter(
                EventModerationLog.event_id==event_id,
                EventModerationLog.action=="remove_guest").one()
            self.assertIn("manual_payment_review:acknowledged",action.details)
            self.assertIn("payment_provider:organizer_direct",action.details)


if __name__=="__main__":
    unittest.main()
