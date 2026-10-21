"""Email ownership verification and password recovery for website accounts.

Codes are hashed at rest; sending is rate limited; password reset revokes all
sessions. Enable Resend only after configuring and verifying the sender domain.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Session

from db.base import Base
from demo_auth_security import (
    hash_password, validate_new_password, guard_rate, record_rate,
)
from demo_email import configured, _send_resend, EmailDeliveryError
from demo_accounts import WebAccount, WebSession, token_hash, normalize_email


class VerifiedEmail(Base):
    __tablename__ = "demo_verified_emails"
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), primary_key=True)
    verified_at = Column(DateTime(timezone=True), nullable=False)


class EmailChallenge(Base):
    __tablename__ = "demo_email_challenges"
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), primary_key=True)
    purpose = Column(String(16), primary_key=True)
    code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)


class EmailRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class EmailCode(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    code: str = Field(min_length=8, max_length=8)


class PasswordReset(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    code: str = Field(min_length=8, max_length=8)
    new_password: str = Field(min_length=12, max_length=128)


def now():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def email_is_verified(db: Session, account_id: int) -> bool:
    return db.get(VerifiedEmail, account_id) is not None


def code_digest(account_id: int, purpose: str, code: str) -> str:
    # Eight-digit OTPs have low entropy: a plain SHA-256 hash can be
    # bruteforced offline from a leaked DB. Use a separate server-side key.
    secret = os.getenv("AUTH_CODE_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="auth_code_secret_not_configured")
    return hmac.new(secret.encode("utf-8"), f"{account_id}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


def send_code(email: str, purpose: str, code: str):
    if not configured():
        raise HTTPException(503, "email_provider_unavailable")
    templates = {
        "verify": ("Verify your TicketTreat email", "Your TicketTreat verification code"),
        "reset": ("Reset your TicketTreat password", "Your TicketTreat password reset code"),
        "login": ("Sign in to TicketTreat", "Your one-time TicketTreat sign-in code"),
        "quick": ("Confirm your TicketTreat registration", "Your one-time TicketTreat signup code"),
    }
    if purpose not in templates:
        raise ValueError("unsupported_challenge_purpose")
    title, msg = templates[purpose]
    try:
        _send_resend({
            "from": os.environ["EMAIL_FROM"].strip(),
            "to": [email],
            "subject": title,
            "html": "<p>" + msg + ": <strong>" + code + "</strong></p><p>This code expires in 10 minutes. If you did not request it, ignore this message.</p>",
            "text": msg + ": " + code + "\nCode expires in 10 minutes.",
        }, "authcode:" + purpose + ":" + secrets.token_hex(16))
    except EmailDeliveryError:
        raise HTTPException(503, "email_delivery_failed")


def create_challenge(db: Session, account: WebAccount, purpose: str):
    code = f"{secrets.randbelow(100_000_000):08d}"
    send_code(account.email, purpose, code)
    row = db.get(EmailChallenge, (account.id, purpose))
    if row is None:
        row = EmailChallenge(account_id=account.id, purpose=purpose)
        db.add(row)
    row.code_hash = code_digest(account.id, purpose, code)
    row.expires_at = now() + timedelta(minutes=10)
    row.attempts = 0
    db.commit()


def consume_challenge(db: Session, account: WebAccount, purpose: str, code: str):
    row = db.get(EmailChallenge, (account.id, purpose))
    if not row or aware(row.expires_at) <= now() or row.attempts >= 5:
        raise HTTPException(400, "invalid_or_expired_code")
    row.attempts += 1
    valid = secrets.compare_digest(row.code_hash, code_digest(account.id, purpose, code))
    if not valid:
        db.commit()
        raise HTTPException(400, "invalid_or_expired_code")
    db.delete(row)
    db.flush()


def install_email_account_security(app, get_db):
    def get_account(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "login_required")
        raw = authorization[7:].strip()
        session = db.query(WebSession).filter(WebSession.token_hash == token_hash(raw)).first()
        if not session or aware(session.expires_at) <= now():
            raise HTTPException(401, "invalid_session")
        account = db.get(WebAccount, session.account_id)
        if not account:
            raise HTTPException(401, "invalid_session")
        return account

    @app.post("/demo/auth/email/request-verification")
    def request_verification(request: Request, account: WebAccount = Depends(get_account),
                             db: Session = Depends(get_db)):
        if email_is_verified(db, account.id):
            return {"status": "already_verified"}
        ip = request.client.host if request.client else "unknown"
        guard_rate(db, "email_verify_ip", ip, 12, 3600)
        guard_rate(db, "email_verify_account", str(account.id), 4, 3600)
        record_rate(db, "email_verify_ip", ip, 3600)
        record_rate(db, "email_verify_account", str(account.id), 3600)
        create_challenge(db, account, "verify")
        return {"status": "sent"}

    @app.post("/demo/auth/email/confirm")
    def confirm_email(payload: EmailCode, account: WebAccount = Depends(get_account),
                      db: Session = Depends(get_db)):
        if normalize_email(payload.email) != account.email:
            raise HTTPException(400, "invalid_or_expired_code")
        consume_challenge(db, account, "verify", payload.code)
        if not email_is_verified(db, account.id):
            db.add(VerifiedEmail(account_id=account.id, verified_at=now()))
            db.flush()
            # Existing active registrations should get a future reminder after
            # email verification, but never a bulk catch-up of old reminders.
            from importlib import import_module
            from demo_email import queue_event_reminder
            main = import_module("main")
            guest = db.query(main.DemoGuest).filter(main.DemoGuest.id == account.guest_id).first()
            if guest is not None:
                rows = db.query(main.DemoTicket, main.Event).join(
                    main.Event, main.DemoTicket.event_id == main.Event.id,
                ).filter(
                    main.DemoTicket.guest_id == guest.id,
                    main.DemoTicket.ticket_status == "active",
                ).all()
                for ticket, event in rows:
                    queue_event_reminder(db, event=event, guest=guest, ticket=ticket)
        db.commit()
        return {"email_verified": True}

    @app.post("/demo/auth/password/forgot")
    def forgot_password(payload: EmailRequest, request: Request, db: Session = Depends(get_db)):
        ip = request.client.host if request.client else "unknown"
        email = normalize_email(payload.email)
        guard_rate(db, "password_reset_ip", ip, 12, 3600)
        guard_rate(db, "password_reset_email", email, 4, 3600)
        record_rate(db, "password_reset_ip", ip, 3600)
        record_rate(db, "password_reset_email", email, 3600)
        if not configured():
            raise HTTPException(503, "email_provider_unavailable")
        account = db.query(WebAccount).filter(WebAccount.email == email).first()
        # Never send a reset code for an account whose email is unverified.
        if account and email_is_verified(db, account.id):
            try:
                create_challenge(db, account, "reset")
            except HTTPException as exc:
                if exc.status_code != 503:
                    raise
                # Avoid distinguishing accounts through the provider error.
                pass
        # Identical response for unknown and known addresses.
        return {"status": "if_account_exists_email_sent"}

    @app.post("/demo/auth/password/reset")
    def reset_password(payload: PasswordReset, request: Request, db: Session = Depends(get_db)):
        ip = request.client.host if request.client else "unknown"
        email = normalize_email(payload.email)
        guard_rate(db, "password_reset_submit_ip", ip, 30, 3600)
        record_rate(db, "password_reset_submit_ip", ip, 3600)
        validate_new_password(payload.new_password)
        account = db.query(WebAccount).filter(WebAccount.email == email).first()
        if not account or not email_is_verified(db, account.id):
            raise HTTPException(400, "invalid_or_expired_code")
        consume_challenge(db, account, "reset", payload.code)
        account.password_hash = hash_password(payload.new_password)
        db.query(WebSession).filter(WebSession.account_id == account.id).delete(synchronize_session=False)
        db.commit()
        return {"status": "password_reset", "sessions_revoked": True}
