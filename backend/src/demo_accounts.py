"""Manual website accounts and organizer CSV for the Crowdly showcase MVP.

Separate from Telegram users. Passwords are PBKDF2-HMAC-SHA256 hashes.
Web sessions are revocable, random bearer tokens stored as SHA-256 hashes.
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
import threading
import time
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

PASSWORD_ITERATIONS = 350_000
SESSION_DAYS = 30
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_ATTEMPTS: dict[str, list[float]] = {}
_ATTEMPT_LOCK = threading.Lock()


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
    password: str = Field(min_length=10, max_length=128)
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
    email: str
    password: str


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


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        name, iterations, salt, expected = stored.split("$", 3)
        if name != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(actual, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normal_contact(value: str) -> str:
    if value not in {"email", "phone", "telegram", "instagram"}:
        raise HTTPException(status_code=422, detail="invalid_contact_preference")
    return value


def throttle(bucket: str, max_attempts: int = 12, window_seconds: int = 600) -> None:
    """Per-process soft throttling for demo signups and login attempts."""
    now = time.monotonic()
    with _ATTEMPT_LOCK:
        recent = [at for at in _ATTEMPTS.get(bucket, []) if now - at < window_seconds]
        if len(recent) >= max_attempts:
            raise HTTPException(status_code=429, detail="too_many_attempts")
        recent.append(now)
        _ATTEMPTS[bucket] = recent


def safe_csv(value: object) -> str:
    """Escape spreadsheet formula injection while keeping normal names readable."""
    raw = "" if value is None else str(value)
    if raw and (raw.lstrip().startswith(("=", "+", "-", "@")) or raw.startswith(("\t", "\r", "\n"))):
        return "'" + raw
    return raw


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
        token = secrets.token_urlsafe(36)
        db.add(WebSession(
            account_id=account.id,
            token_hash=token_hash(token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
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
            "email_verified": False,
            "admin_claim_available": bool(
                account.email.casefold() in permanent_global_admin_emails()
                and len(os.getenv("GLOBAL_ADMIN_RECOVERY_SECRET", "")) >= 32
                and role_for(db, account) != "global_admin"
            ),
        }

    @app.post("/demo/auth/signup", status_code=201)
    def signup(payload: SignupData, request: Request, db: Session = Depends(get_db)):
        throttle("signup:" + (request.client.host if request.client else "unknown"), 8)
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
        throttle("login:" + (request.client.host if request.client else "unknown"), 20)
        email = normalize_email(payload.email)
        account = db.query(WebAccount).filter(WebAccount.email == email).first()
        if account is None or not verify_password(payload.password, account.password_hash):
            raise HTTPException(status_code=401, detail="invalid_credentials")
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
