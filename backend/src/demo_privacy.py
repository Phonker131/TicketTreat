"""Account privacy requests with proof-of-identity and an auditable lifecycle.

A request is NOT an immediate erasure: active event bookings, organizer records,
fraud prevention and statutory financial retention may require review. These
records are retained only for subsequent controlled fulfillment.
"""
from __future__ import annotations

import calendar
import os
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Session

from db.base import Base
from demo_accounts import WebAccount
from demo_auth_security import verify_password, guard_rate, record_rate
from demo_roles import account_lookup


class PrivacyRequest(Base):
    __tablename__ = "demo_privacy_requests"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    request_type = Column(String(24), nullable=False, default="erasure")
    status = Column(String(24), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    resolution_note = Column(String(500), nullable=True)
    resolved_by = Column(Integer, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class RequestErasure(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)


class FulfillErasure(BaseModel):
    confirmation: str = Field(pattern="^ERASE$")
    justification: str = Field(min_length=12, max_length=500)


def response_due_at(created_at: datetime) -> datetime:
    """Calendar-month GDPR response target, retaining UTC timestamps."""
    value=created_at
    year=value.year+(1 if value.month==12 else 0)
    month=1 if value.month==12 else value.month+1
    last_day=calendar.monthrange(year,month)[1]
    return value.replace(year=year,month=month,day=min(value.day,last_day))


def install_privacy_routes(app, get_db, main):
    def current(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        return account_lookup(db, authorization)

    @app.get("/demo/auth/privacy-request")
    def privacy_status(account: WebAccount = Depends(current),
                       db: Session = Depends(get_db)):
        item=(db.query(PrivacyRequest)
            .filter(PrivacyRequest.account_id == account.id,
                    PrivacyRequest.request_type == "erasure")
            .order_by(PrivacyRequest.id.desc()).first())
        return {"status": item.status if item else "none",
                "requested_at": item.created_at if item else None,
                "updated_at": item.updated_at if item else None,
                "response_due_at": response_due_at(item.created_at) if item else None,
                "note": "Submitting a request does not delete event or financial records immediately."}

    @app.post("/demo/auth/privacy-request", status_code=202)
    def request_erasure(payload: RequestErasure, request: Request,
                        account: WebAccount = Depends(current),
                        db: Session = Depends(get_db)):
        guard_rate(db, "privacy_request_account", str(account.id), 6, 3600)
        record_rate(db, "privacy_request_account", str(account.id), 3600)
        if not verify_password(payload.current_password, account.password_hash):
            raise HTTPException(status_code=403, detail="password_confirmation_failed")
        now=datetime.now(timezone.utc)
        item=(db.query(PrivacyRequest)
            .filter(PrivacyRequest.account_id == account.id,
                    PrivacyRequest.request_type == "erasure",
                    PrivacyRequest.status == "pending")
            .with_for_update().first())
        if item is None:
            item=PrivacyRequest(account_id=account.id,request_type="erasure",
                status="pending",created_at=now,updated_at=now)
            db.add(item)
        db.commit()
        return {"status": "pending", "message": "Your erasure request has been registered for review."}

    @app.delete("/demo/auth/privacy-request")
    def withdraw_erasure(account: WebAccount = Depends(current),
                         db: Session = Depends(get_db)):
        now=datetime.now(timezone.utc)
        items=(db.query(PrivacyRequest)
            .filter(PrivacyRequest.account_id == account.id,
                    PrivacyRequest.request_type == "erasure",
                    PrivacyRequest.status == "pending")
            .with_for_update().all())
        for item in items:
            item.status="withdrawn"
            item.updated_at=now
        db.commit()
        return {"status": "withdrawn" if items else "none"}

    def global_admin(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        from demo_roles import role_for
        admin=account_lookup(db,authorization)
        if role_for(db,admin)!="global_admin":
            raise HTTPException(403,"global_admin_only")
        return admin

    @app.get("/demo/manage/privacy-requests")
    def pending_requests(admin:WebAccount=Depends(global_admin),
                         db:Session=Depends(get_db)):
        records=(db.query(PrivacyRequest,WebAccount)
            .join(WebAccount,WebAccount.id==PrivacyRequest.account_id)
            .filter(PrivacyRequest.status=="pending")
            .order_by(PrivacyRequest.created_at).limit(100).all())
        now=datetime.now(timezone.utc)
        return [{"request_id":r.id,"account_id":r.account_id,
                 "email":a.email,"created_at":r.created_at,
                 "response_due_at":response_due_at(r.created_at),
                 "overdue":response_due_at(r.created_at)<now}
                for r,a in records]

    @app.post("/demo/manage/privacy-requests/{request_id}/fulfill")
    def fulfill(request_id:int,payload:FulfillErasure,
                admin:WebAccount=Depends(global_admin),
                db:Session=Depends(get_db)):
        from demo_roles import EventOwnership,WebAccountRole,GlobalAdminBinding,GlobalAdminDelegation,AccountAdminAudit,role_for
        from demo_accounts import WebSession
        from demo_account_recovery import VerifiedEmail,EmailChallenge
        from demo_auth_security import hash_password
        from demo_mfa import MFAFactor,MFASession
        from demo_email import EmailOutbox
        from demo_geography import DemoAccountPlace
        from demo_telegram import DemoTelegramIdentity, TelegramLinkChallenge
        from demo_legacy import LegacyTicketClaim
        from demo_support import SupportTicket, SupportMessage, SupportAdminRead

        item=db.query(PrivacyRequest).filter(
            PrivacyRequest.id==request_id).with_for_update().first()
        if item is None or item.status!="pending":
            raise HTTPException(404,"pending_request_not_found")
        account=db.query(WebAccount).filter(
            WebAccount.id==item.account_id).with_for_update().first()
        if account is None: raise HTTPException(409,"account_missing")
        guest=db.query(main.DemoGuest).filter(
            main.DemoGuest.id==account.guest_id).with_for_update().first()
        if guest is None: raise HTTPException(409,"guest_missing")

        blockers=[]
        if account.id==admin.id or role_for(db,account)=="global_admin":
            blockers.append("privileged_account")
        if db.query(EventOwnership).filter(EventOwnership.owner_account_id==account.id).first():
            blockers.append("organizer_owns_events")
        if db.query(DemoTelegramIdentity).filter(DemoTelegramIdentity.guest_id==guest.id).first():
            blockers.append("linked_telegram_requires_review")
        tickets=db.query(main.DemoTicket).filter(main.DemoTicket.guest_id==guest.id).all()
        waits=db.query(main.DemoWaitlist).filter(main.DemoWaitlist.guest_id==guest.id).all()
        if tickets:
            days=os.getenv("PRIVACY_FREE_TICKET_RETENTION_DAYS","")
            if not days.isdecimal():
                blockers.append("retention_policy_not_configured")
            else:
                cutoff=datetime.now(timezone.utc)-timedelta(days=int(days))
                for ticket in tickets:
                    event=db.query(main.Event).filter(main.Event.id==ticket.event_id).first()
                    if ticket.payment_provider not in {"free","legacy_free"}:
                        blockers.append("financial_records")
                    elif event is None or event.starts_at is None or main.normalize_event_datetime(event.starts_at).astimezone(timezone.utc)>cutoff:
                        blockers.append("ticket_retention_window")
                    elif db.query(LegacyTicketClaim).filter(LegacyTicketClaim.ticket_id==ticket.id).first():
                        blockers.append("legacy_record_requires_review")
        for waiting in waits:
            event=db.query(main.Event).filter(main.Event.id==waiting.event_id).first()
            if event is None or not main.event_is_past(event):
                blockers.append("active_waitlist")
                break
        support_tickets=db.query(SupportTicket).filter(SupportTicket.account_id==account.id).all()
        if any(ticket.status!="closed" for ticket in support_tickets):
            blockers.append("active_support_ticket")
        if blockers:
            raise HTTPException(409,{"code":"manual_review_required",
                                     "blockers":sorted(set(blockers))})

        # Transactional pseudonymization and deletion of eligible personal data.
        # Support conversations contain personal details. Delete the
        # outgoing support replies as well (they are not guest-linked), then
        # erase messages, per-admin read markers, and closed ticket records.
        support_ids=[ticket.id for ticket in support_tickets]
        if support_ids:
            msg_ids=[item[0] for item in db.query(SupportMessage.id).filter(
                SupportMessage.ticket_id.in_(support_ids)).all()]
            if msg_ids:
                db.query(EmailOutbox).filter(EmailOutbox.kind=="support_reply",
                    EmailOutbox.notice_id.in_(msg_ids)).delete(synchronize_session=False)
            db.query(SupportAdminRead).filter(
                SupportAdminRead.ticket_id.in_(support_ids)).delete(synchronize_session=False)
            db.query(SupportMessage).filter(
                SupportMessage.ticket_id.in_(support_ids)).delete(synchronize_session=False)
            db.query(SupportTicket).filter(
                SupportTicket.id.in_(support_ids)).delete(synchronize_session=False)
        db.query(EmailOutbox).filter(EmailOutbox.guest_id==guest.id).delete(synchronize_session=False)
        db.query(main.DemoTicket).filter(main.DemoTicket.guest_id==guest.id).delete(synchronize_session=False)
        db.query(main.DemoWaitlist).filter(main.DemoWaitlist.guest_id==guest.id).delete(synchronize_session=False)
        session_hashes=[x[0] for x in db.query(WebSession.token_hash).filter(
            WebSession.account_id==account.id).all()]
        if session_hashes:
            db.query(MFASession).filter(MFASession.session_hash.in_(session_hashes)).delete(synchronize_session=False)
        db.query(WebSession).filter(WebSession.account_id==account.id).delete(synchronize_session=False)
        # Revoke pending browser-to-Telegram linking challenges on erasure.
        db.query(TelegramLinkChallenge).filter(TelegramLinkChallenge.account_id==account.id).delete(synchronize_session=False)
        db.query(MFAFactor).filter(MFAFactor.account_id==account.id).delete(synchronize_session=False)
        db.query(VerifiedEmail).filter(VerifiedEmail.account_id==account.id).delete(synchronize_session=False)
        db.query(EmailChallenge).filter(EmailChallenge.account_id==account.id).delete(synchronize_session=False)
        from demo_organizer_profiles import OrganizerPublicProfile
        db.query(OrganizerPublicProfile).filter(OrganizerPublicProfile.account_id==account.id).delete(synchronize_session=False)
        db.query(DemoAccountPlace).filter(DemoAccountPlace.account_id==account.id).delete(synchronize_session=False)
        db.query(WebAccountRole).filter(WebAccountRole.account_id==account.id).delete(synchronize_session=False)
        db.query(GlobalAdminBinding).filter(GlobalAdminBinding.account_id==account.id).delete(synchronize_session=False)
        db.query(GlobalAdminDelegation).filter(GlobalAdminDelegation.account_id==account.id).delete(synchronize_session=False)
        from demo_google import GoogleIdentity, GoogleFlow
        db.query(GoogleIdentity).filter(GoogleIdentity.account_id==account.id).delete(synchronize_session=False)
        db.query(GoogleFlow).filter(GoogleFlow.account_id==account.id).delete(synchronize_session=False)
        guest.access_token=secrets.token_urlsafe(32)
        guest.telegram_id=None;guest.username=None;guest.email=None
        guest.first_name="Erased";guest.last_name=None
        account.email=f"erased-{account.id}@users.invalid"
        account.password_hash=hash_password(secrets.token_urlsafe(48))
        account.first_name="Erased";account.last_name="Account"
        account.phone=None;account.instagram=None;account.contact_preference="email"
        item.status="fulfilled";item.resolved_by=admin.id
        item.resolution_note=payload.justification.strip()
        item.resolved_at=datetime.now(timezone.utc)
        item.updated_at=item.resolved_at
        db.add(AccountAdminAudit(actor_account_id=admin.id,
                 target_account_id=account.id,action="privacy_erasure_fulfilled"))
        db.commit()
        return {"status":"fulfilled","account_id":account.id}
