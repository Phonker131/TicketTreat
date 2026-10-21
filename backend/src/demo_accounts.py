"""Manual website accounts and organizer CSV for the Crowdly showcase MVP.

Separate from Telegram users. New passwords are Argon2id; PBKDF2 legacy
hashes are upgraded after successful login. Session tokens are random,
revocable bearer tokens stored as SHA-256 hashes.
This is a DEMO auth flow: email ownership is NOT yet verified.
"""
from __future__ import annotations

import csv
import hashlib
import hmac
import io
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base
from demo_geography import DemoAccountPlace, clean_location, place_dict, save_place
from demo_email import queue_email
from demo_auth_security import AuthRateBucket, hash_password, verify_password, needs_rehash, validate_new_password, guard_rate, record_rate, clear_rate

SESSION_DAYS = 7
MAX_ACTIVE_SESSIONS = 5
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class WebAccount(Base):
    __tablename__ = "demo_web_accounts"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(40), nullable=True)
    instagram = Column(String(100), nullable=True)
    contact_preference = Column(String(20), nullable=False, default="email")
    guest_id = Column(Integer, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class WebSession(Base):
    __tablename__ = "demo_web_sessions"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)


class SignupData(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=12, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=40)
    instagram: str | None = Field(default=None, max_length=100)
    contact_preference: str = "email"
    guest_token: str | None = Field(default=None, max_length=128)
    language: str = Field(default="en", max_length=8)
    account_role: str = Field(default="participant", pattern="^(participant|organizer)$")
    country_code: str = Field(min_length=2, max_length=2)
    city: str = Field(min_length=1, max_length=100)


class LoginData(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordData(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class ProfileUpdateData(BaseModel):
    country_code: str | None = Field(default=None, max_length=2)
    city: str | None = Field(default=None, max_length=100)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=40)
    instagram: str | None = Field(default=None, max_length=100)
    contact_preference: str = "email"


def normalize_email(email: str) -> str:
    value = email.strip().lower()
    if len(value) > 255 or not EMAIL_RE.fullmatch(value):
        raise HTTPException(status_code=422, detail="invalid_email")
    return value


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normal_contact(value: str) -> str:
    if value not in {"email", "phone", "telegram", "instagram"}:
        raise HTTPException(status_code=422, detail="invalid_contact_preference")
    return value


def safe_csv(value: object) -> str:
    """Escape spreadsheet formula injection while keeping normal names readable."""
    raw = "" if value is None else str(value)
    if raw and (raw.lstrip().startswith(("=", "+", "-", "@")) or raw.startswith(("\t", "\r", "\n"))):
        return "'" + raw
    return raw


def _verified_email(db: Session, account_id: int) -> bool:
    from demo_account_recovery import email_is_verified
    return email_is_verified(db, account_id)


def install_demo_accounts(
    app,
    DemoGuest,
    DemoTicket,
    DemoWaitlist,
    Event,
    User,
    Registration,
    RegistrationPayment,
    get_db,
    require_demo_admin,
):
    from demo_roles import WebAccountRole, role_for, permanent_global_admin_emails
    def issue_session(db: Session, account: WebAccount) -> str:
        # New sessions last 7 days. Old sessions retain their original expiry;
        # no existing account is logged out by this deployment.
        now = datetime.now(timezone.utc)
        db.query(WebSession).filter(
            WebSession.account_id == account.id,
            WebSession.expires_at <= now,
        ).delete(synchronize_session=False)
        existing = db.query(WebSession).filter(
            WebSession.account_id == account.id,
        ).order_by(WebSession.created_at.desc(), WebSession.id.desc()).all()
        for expired_extra in existing[MAX_ACTIVE_SESSIONS - 1:]:
            db.delete(expired_extra)
        token = secrets.token_urlsafe(36)
        db.add(WebSession(
            account_id=account.id,
            token_hash=token_hash(token),
            expires_at=now + timedelta(days=SESSION_DAYS),
        ))
        db.commit()
        return token

    def get_current_account(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> WebAccount:
        prefix = "Bearer "
        if not authorization or not authorization.startswith(prefix):
            raise HTTPException(status_code=401, detail="login_required")
        token = authorization[len(prefix):].strip()
        if len(token) < 30 or len(token) > 160:
            raise HTTPException(status_code=401, detail="invalid_session")
        session = db.query(WebSession).filter(WebSession.token_hash == token_hash(token)).first()
        if session is None:
            raise HTTPException(status_code=401, detail="invalid_session")
        expiry = session.expires_at
        if expiry.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc) if expiry.tzinfo is None else expiry <= datetime.now(timezone.utc):
            db.delete(session)
            db.commit()
            raise HTTPException(status_code=401, detail="session_expired")
        account = db.query(WebAccount).filter(WebAccount.id == session.account_id).first()
        if account is None:
            raise HTTPException(status_code=401, detail="invalid_session")
        return account

    def profile_dict(account: WebAccount, db: Session) -> dict:
        guest = db.query(DemoGuest).filter(DemoGuest.id == account.guest_id).first()
        if guest is None:
            raise HTTPException(status_code=500, detail="profile_missing_guest")
        checkins = db.query(func.count(DemoTicket.id)).filter(
            DemoTicket.guest_id == guest.id,
            DemoTicket.ticket_status == "active",
            DemoTicket.checked_in_at.isnot(None),
        ).scalar() or 0
        role = role_for(db, account)
        return {
            "admin_claim_available": (
                role != "global_admin"
                and account.email.casefold() in permanent_global_admin_emails()
            ),
            "account": {
                "id": account.id, "email": account.email,
                "first_name": account.first_name, "last_name": account.last_name,
                "phone": account.phone, "instagram": account.instagram,
                "contact_preference": account.contact_preference,
                "created_at": account.created_at,
                "id": account.id,
                "role": role_for(db, account),
                **place_dict(db, DemoAccountPlace, "account_id", account.id),
            },
            "guest": {
                "id": guest.id, "access_token": guest.access_token,
                "telegram_id": guest.telegram_id, "username": guest.username,
                "email": guest.email, "first_name": guest.first_name,
                "last_name": guest.last_name, "visits": int(checkins),
            },
            "email_verified": _verified_email(db, account.id),
            "admin_claim_available": bool(
                account.email.casefold() in permanent_global_admin_emails()
                and _verified_email(db, account.id)
                and len(os.getenv("GLOBAL_ADMIN_RECOVERY_SECRET", "")) >= 32
                and role_for(db, account) != "global_admin"
            ),
        }

    @app.post("/demo/auth/signup", status_code=201)
    def signup(payload: SignupData, request: Request, db: Session = Depends(get_db)):
        source_ip = request.client.host if request.client else "unknown"
        guard_rate(db, "signup_ip", source_ip, 40, 600)
        record_rate(db, "signup_ip", source_ip, 600)
        validate_new_password(payload.password)
        email = normalize_email(payload.email)
        if db.query(WebAccount.id).filter(WebAccount.email == email).first():
            raise HTTPException(status_code=409, detail="email_already_registered")
        contact = normal_contact(payload.contact_preference)
        country_code, city = clean_location(payload.country_code, payload.city)
        first = payload.first_name.strip()
        last = payload.last_name.strip()
        if not first or not last:
            raise HTTPException(status_code=422, detail="name_required")
        if payload.guest_token:
            guest = db.query(DemoGuest).filter(
                DemoGuest.access_token == payload.guest_token,
                func.lower(DemoGuest.email) == email,
            ).first()
            if guest and db.query(WebAccount.id).filter(WebAccount.guest_id == guest.id).first():
                guest = None
        else:
            guest = None
        try:
            if guest is None:
                guest = DemoGuest(
                    access_token=secrets.token_urlsafe(32),
                    first_name=first, last_name=last, email=email,
                )
                db.add(guest)
                db.flush()
            account = WebAccount(
                email=email, password_hash=hash_password(payload.password),
                first_name=first, last_name=last,
                phone=payload.phone.strip() if payload.phone else None,
                instagram=payload.instagram.strip() if payload.instagram else None,
                contact_preference=contact, guest_id=guest.id,
            )
            guest.first_name, guest.last_name, guest.email = first, last, email
            db.add(account)
            db.flush()
            db.add(WebAccountRole(account_id=account.id, role=payload.account_role))
            save_place(db, DemoAccountPlace, "account_id", account.id, country_code, city)
            db.flush()
            queue_email(
                db, kind="welcome", event_key=f"welcome:{account.id}",
                recipient=account.email, guest_id=guest.id, language=payload.language,
            )
            # If the person booked before creating the account, send their
            # existing active ticket now, once ownership of this demo profile
            # has been attached to the account.
            for active_ticket in db.query(DemoTicket).filter(
                DemoTicket.guest_id == guest.id,
                DemoTicket.ticket_status == "active",
            ).all():
                queue_email(
                    db, kind="ticket",
                    event_key=f"ticket:{active_ticket.id}:issue:{hashlib.sha256(active_ticket.qr_token.encode()).hexdigest()[:20]}",
                    recipient=account.email, guest_id=guest.id, ticket_id=active_ticket.id,
                    language=payload.language,
                )
            db.commit()
            db.refresh(account)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="email_already_registered")
        access_token = issue_session(db, account)
        return {"token": access_token, "profile": profile_dict(account, db)}

    @app.post("/demo/auth/login")
    def login(payload: LoginData, request: Request, db: Session = Depends(get_db)):
        email = normalize_email(payload.email)
        source_ip = request.client.host if request.client else "unknown"
        guard_rate(db, "login_ip", source_ip, 200, 900)
        guard_rate(db, "login_email", email, 12, 900)
        account = db.query(WebAccount).filter(WebAccount.email == email).first()
        if account is None or not verify_password(payload.password, account.password_hash):
            record_rate(db, "login_ip", source_ip, 900)
            record_rate(db, "login_email", email, 900)
            raise HTTPException(status_code=401, detail="invalid_credentials")
        # Rehash the stored PBKDF2 password only after a successful login.
        if needs_rehash(account.password_hash):
            account.password_hash = hash_password(payload.password)
            db.flush()
        clear_rate(db, "login_email", email)
        token = issue_session(db, account)
        return {"token": token, "profile": profile_dict(account, db)}

    @app.get("/demo/auth/me")
    def get_me(account: WebAccount = Depends(get_current_account), db: Session = Depends(get_db)):
        return profile_dict(account, db)

    @app.patch("/demo/auth/me")
    def update_me(
        payload: ProfileUpdateData,
        account: WebAccount = Depends(get_current_account),
        db: Session = Depends(get_db),
    ):
        first, last = payload.first_name.strip(), payload.last_name.strip()
        if not first or not last:
            raise HTTPException(status_code=422, detail="name_required")
        account.first_name, account.last_name = first, last
        account.phone = payload.phone.strip() if payload.phone else None
        account.instagram = payload.instagram.strip() if payload.instagram else None
        account.contact_preference = normal_contact(payload.contact_preference)
        existing_place = db.query(DemoAccountPlace).filter(DemoAccountPlace.account_id == account.id).first()
        if payload.country_code is not None or payload.city is not None:
            country = payload.country_code if payload.country_code is not None else (existing_place.country_code if existing_place else None)
            city = payload.city if payload.city is not None else (existing_place.city if existing_place else None)
            save_place(db, DemoAccountPlace, "account_id", account.id, country, city)
        guest = db.query(DemoGuest).filter(DemoGuest.id == account.guest_id).first()
        if guest:
            guest.first_name, guest.last_name = first, last
        db.commit()
        db.refresh(account)
        return profile_dict(account, db)

    @app.post("/demo/auth/change-password")
    def change_password(
        payload: ChangePasswordData,
        account: WebAccount = Depends(get_current_account),
        db: Session = Depends(get_db),
    ):
        """Change password and revoke every session on every device."""
        validate_new_password(payload.new_password)
        guard_rate(db, "change_password_account", str(account.id), 8, 3600)
        if not verify_password(payload.current_password, account.password_hash):
            record_rate(db, "change_password_account", str(account.id), 3600)
            raise HTTPException(status_code=401, detail="invalid_current_password")
        clear_rate(db, "change_password_account", str(account.id))
        if payload.current_password == payload.new_password:
            raise HTTPException(status_code=422, detail="password_must_change")
        account.password_hash = hash_password(payload.new_password)
        db.query(WebSession).filter(
            WebSession.account_id == account.id,
        ).delete(synchronize_session=False)
        db.flush()
        new_token = issue_session(db, account)
        return {"token": new_token, "profile": profile_dict(account, db)}

    @app.post("/demo/auth/logout-all")
    def logout_everywhere(
        account: WebAccount = Depends(get_current_account),
        db: Session = Depends(get_db),
    ):
        revoked = db.query(WebSession).filter(
            WebSession.account_id == account.id,
        ).delete(synchronize_session=False)
        db.commit()
        return {"status": "logged_out_everywhere", "sessions_revoked": revoked}

    @app.get("/demo/auth/sessions")
    def active_sessions(
        account: WebAccount = Depends(get_current_account),
        db: Session = Depends(get_db),
    ):
        now = datetime.now(timezone.utc)
        rows = db.query(WebSession).filter(
            WebSession.account_id == account.id,
            WebSession.expires_at > now,
        ).order_by(WebSession.created_at.desc()).limit(MAX_ACTIVE_SESSIONS + 5).all()
        return {
            "sessions": [{"id": s.id, "created_at": s.created_at,
                          "expires_at": s.expires_at} for s in rows],
        }

    @app.post("/demo/auth/logout")
    def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        if authorization and authorization.startswith("Bearer "):
            digest = token_hash(authorization[7:].strip())
            db.query(WebSession).filter(WebSession.token_hash == digest).delete()
            db.commit()
        return {"status": "logged_out"}

    @app.get("/demo/admin/events/{event_id}/participants.csv")
    def export_participants(
        event_id: int,
        _admin_key: str = Depends(require_demo_admin),
        db: Session = Depends(get_db),
    ):
        event = db.query(Event).filter(Event.id == event_id).first()
        if event is None:
            raise HTTPException(status_code=404, detail="event_not_found")
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Source", "First name", "Last name", "Email", "Phone",
            "Telegram ID", "Telegram username", "Ticket code", "Registration status",
            "Payment status", "Check-in status", "Checked in at",
            "Waitlist status", "Contact preference",
        ])
        def write(*values):
            writer.writerow([safe_csv(v) for v in values])

        tickets = db.query(DemoTicket, DemoGuest).join(
            DemoGuest, DemoGuest.id == DemoTicket.guest_id
        ).filter(DemoTicket.event_id == event_id).order_by(DemoTicket.id.asc()).all()
        for ticket, guest in tickets:
            account = db.query(WebAccount).filter(WebAccount.guest_id == guest.id).first()
            write(
                "website" if account else "demo guest",
                guest.first_name, guest.last_name, guest.email,
                account.phone if account else "",
                guest.telegram_id, guest.username,
                f"CRD-{ticket.id:06d}", ticket.ticket_status,
                ticket.payment_status, "checked_in" if ticket.checked_in_at else "not_checked_in",
                ticket.checked_in_at.isoformat() if ticket.checked_in_at else "", "",
                account.contact_preference if account else "",
            )

        registrations = db.query(Registration, User).join(
            User, Registration.user_id == User.id,
        ).filter(Registration.event_id == event_id).order_by(Registration.id.asc()).all()
        for registration, user in registrations:
            payment = db.query(RegistrationPayment).filter(
                RegistrationPayment.event_id == event_id,
                RegistrationPayment.user_id == user.id,
            ).first()
            payment_status = payment.payment_status if payment else "confirmed_legacy"
            write(
                "telegram bot", user.first_name, user.last_name, "",
                user.phone, user.telegram_id, user.username, "",
                "registered", payment_status, "not_tracked", "", "",
                user.contact_preference,
            )

        waitlist = db.query(DemoWaitlist, DemoGuest).join(
            DemoGuest, DemoGuest.id == DemoWaitlist.guest_id,
        ).filter(
            DemoWaitlist.event_id == event_id,
            DemoWaitlist.status == "waiting",
        ).order_by(DemoWaitlist.created_at.asc()).all()
        for entry, guest in waitlist:
            write(
                "waitlist", guest.first_name, guest.last_name, guest.email, "",
                guest.telegram_id, guest.username, "", "waiting", "not_paid",
                "not_checked_in", "", entry.status, "",
            )
        body = ("\ufeff" + output.getvalue()).encode("utf-8")
        return Response(
            content=body,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="crowdly-event-{event_id}-participants.csv"',
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )
