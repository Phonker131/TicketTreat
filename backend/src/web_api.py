"""Authenticated website / Telegram Mini App API. New endpoints only.

Existing bot endpoints are unchanged for backwards compatibility, but MUST be
protected with a server-to-server credential before publishing the backend.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Session

from db.base import Base
from db.session import get_db
from db import models
from miniapp_auth import MiniAppAuthError, validate_init_data


class EmailIdentity(Base):
    __tablename__ = "web_email_identities"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(300), nullable=False)


class WebSession(Base):
    __tablename__ = "web_sessions"
    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class PendingSignup(Base):
    __tablename__ = "web_pending_signups"
    email = Column(String(320), primary_key=True)
    password_hash = Column(String(300), nullable=False)
    code_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)


class EmailCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class VerifySignup(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ProfileInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=30)
    contact_preference: str = Field(pattern="^(telegram|phone|instagram)$")
    instagram: str | None = None


router = APIRouter(prefix="/api/v1")
SESSION_HOURS = 72


def utcnow():
    return datetime.now(timezone.utc)


def aware(dt):
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def password_hash(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 350_000)
    return salt.hex() + ":" + digest.hex()


def password_matches(password, encoded):
    try:
        salt, _ = encoded.split(":", 1)
        return hmac.compare_digest(password_hash(password, bytes.fromhex(salt)), encoded)
    except (ValueError, TypeError):
        return False


def create_session(db, user_id):
    token = secrets.token_urlsafe(36)
    db.add(WebSession(token_hash=hashlib.sha256(token.encode()).hexdigest(),
                      user_id=user_id, expires_at=utcnow() + timedelta(hours=SESSION_HOURS)))
    db.commit()
    return {"access_token": token, "token_type": "bearer", "expires_in": SESSION_HOURS * 3600}


def current_user(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Authentication required")
    session = db.query(WebSession).filter_by(token_hash=hashlib.sha256(token.encode()).hexdigest()).first()
    if session is None or aware(session.expires_at) <= utcnow():
        raise HTTPException(401, "Session expired")
    user = db.get(models.User, session.user_id)
    if user is None:
        raise HTTPException(401, "Account unavailable")
    return user


def send_verification(email, code):
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM")
    if not host or not sender:
        raise HTTPException(503, "Email registration not configured")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, email, "TicketTreat verification code"
    msg.set_content(f"Your TicketTreat verification code is {code}. It expires in 10 minutes.")
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=10) as smtp:
            smtp.starttls()
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)
    except Exception as exc:
        raise HTTPException(503, "Verification email could not be sent") from exc


@router.post("/auth/email/signup", status_code=202)
def signup(payload: EmailCredentials, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if db.query(EmailIdentity).filter_by(email=email).first():
        raise HTTPException(409, "Email already registered")
    code = f"{secrets.randbelow(1000000):06d}"
    pending = db.get(PendingSignup, email) or PendingSignup(email=email)
    pending.password_hash = password_hash(payload.password)
    pending.code_hash = hashlib.sha256((email + ":" + code).encode()).hexdigest()
    pending.expires_at = utcnow() + timedelta(minutes=10)
    pending.attempts = 0
    send_verification(email, code)
    db.add(pending)
    db.commit()
    return {"status": "verification_sent"}


@router.post("/auth/email/verify")
def verify_signup(payload: VerifySignup, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    pending = db.get(PendingSignup, email)
    digest = hashlib.sha256((email + ":" + payload.code).encode()).hexdigest()
    if pending is None or aware(pending.expires_at) < utcnow() or pending.attempts >= 5:
        raise HTTPException(400, "Invalid or expired verification code")
    pending.attempts += 1
    if not hmac.compare_digest(digest, pending.code_hash):
        db.commit()
        raise HTTPException(400, "Invalid or expired verification code")
    if db.query(EmailIdentity).filter_by(email=email).first():
        raise HTTPException(409, "Email already registered")
    user = models.User(telegram_id=None)
    db.add(user)
    db.flush()
    db.add(EmailIdentity(user_id=user.id, email=email, password_hash=pending.password_hash))
    db.delete(pending)
    db.commit()
    return create_session(db, user.id)


@router.post("/auth/email/login")
def email_login(payload: EmailCredentials, db: Session = Depends(get_db)):
    identity = db.query(EmailIdentity).filter_by(email=payload.email.lower().strip()).first()
    # Same generic error to avoid account enumeration.
    if identity is None or not password_matches(payload.password, identity.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return create_session(db, identity.user_id)


@router.post("/auth/telegram")
def telegram_login(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("tma "):
        raise HTTPException(401, "Telegram launch data required")
    try:
        tg_user = validate_init_data(authorization[4:], os.environ["BOT_TOKEN"])
    except (MiniAppAuthError, KeyError):
        raise HTTPException(401, "Invalid Telegram launch data")
    user = db.query(models.User).filter_by(telegram_id=tg_user["id"]).first()
    if user is None:
        user = models.User(telegram_id=tg_user["id"], username=tg_user.get("username"),
                           first_name=tg_user.get("first_name"))
        db.add(user)
        db.commit()
        db.refresh(user)
    return create_session(db, user.id)


@router.post("/auth/telegram/link")
def link_telegram(authorization: str | None = Header(None),
                  x_telegram_init_data: str | None = Header(None),
                  user=Depends(current_user), db: Session = Depends(get_db)):
    if not x_telegram_init_data:
        raise HTTPException(401, "Signed Telegram login is required")
    try:
        telegram = validate_init_data(x_telegram_init_data, os.environ["BOT_TOKEN"])
    except (MiniAppAuthError, KeyError):
        raise HTTPException(401, "Invalid Telegram launch data")
    existing = db.query(models.User).filter_by(telegram_id=telegram["id"]).first()
    if existing is not None and existing.id != user.id:
        raise HTTPException(409, "Telegram identity belongs to another account")
    if user.telegram_id is not None and user.telegram_id != telegram["id"]:
        raise HTTPException(409, "Another Telegram identity is already linked")
    user.telegram_id = telegram["id"]
    user.username = telegram.get("username")
    db.commit()
    return {"telegram_connected": True}


@router.get("/me")
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    identity = db.query(EmailIdentity).filter_by(user_id=user.id).first()
    return {"id": user.id, "telegram_connected": user.telegram_id is not None,
            "email": identity.email if identity else None,
            "first_name": user.first_name, "last_name": user.last_name, "phone": user.phone,
            "contact_preference": user.contact_preference, "instagram": user.instagram,
            "complete": bool(user.first_name and user.last_name and user.phone and user.contact_preference)}


@router.put("/me")
def update_me(payload: ProfileInput, user=Depends(current_user), db: Session = Depends(get_db)):
    if payload.contact_preference == "instagram" and not payload.instagram:
        raise HTTPException(422, "Instagram username required")
    if payload.contact_preference == "telegram" and user.telegram_id is None:
        raise HTTPException(422, "Connect Telegram to use Telegram contact method")
    for field, value in payload.model_dump().items():
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return me(user, db)


@router.get("/events")
def events(db: Session = Depends(get_db)):
    import main as core
    return core.list_events(False, db)


@router.get("/events/{event_id}")
def event_detail(event_id: int, db: Session = Depends(get_db)):
    import main as core
    event = core.get_event(event_id, db)
    if "error" in event:
        raise HTTPException(404, "Event not found")
    return event


@router.get("/me/events")
def my_events(user=Depends(current_user), db: Session = Depends(get_db)):
    import main as core
    items = (db.query(models.Event).join(models.Registration)
             .filter(models.Registration.user_id == user.id)
             .order_by(models.Event.starts_at.asc()).all())
    return [core.event_to_dict(item, db=db, registered_count=core.get_registered_count(db, item.id),
             registration_user_id=user.id) for item in items]


@router.post("/events/{event_id}/register")
def register(event_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    import main as core
    if not (user.first_name and user.last_name and user.phone and user.contact_preference):
        raise HTTPException(422, "Complete your profile first")
    # Serialize registration operations for this event by locking its row.
    event = db.query(models.Event).filter_by(id=event_id).with_for_update().first()
    if event is None:
        raise HTTPException(404, "Event not found")
    if event.is_cancelled or event.starts_at is None or core.event_has_started(event):
        raise HTTPException(409, "Event unavailable")
    if db.query(models.Registration).filter_by(user_id=user.id, event_id=event_id).first():
        raise HTTPException(409, "Already registered")
    count = core.get_registered_count(db, event_id)
    if event.max_participants is not None and count >= event.max_participants:
        raise HTTPException(409, "Event full")
    if core.event_requires_payment(event):
        settings = core.get_payment_settings(db, event_id)
        if not settings or not settings.payment_instructions.strip():
            raise HTTPException(409, "Payment setup unavailable")
    db.add(models.Registration(user_id=user.id, event_id=event_id))
    if core.event_requires_payment(event):
        db.add(core.RegistrationPayment(event_id=event_id, user_id=user.id,
            payment_status="pending", payment_deadline=utcnow() + timedelta(hours=24)))
    db.commit()
    return core.registration_response(status="registered", db=db, event=event, user_id=user.id,
                                       registered_count=count + 1)


@router.delete("/events/{event_id}/register")
def unregister(event_id: int, user=Depends(current_user), db: Session = Depends(get_db)):
    import main as core
    reg = db.query(models.Registration).filter_by(event_id=event_id, user_id=user.id).first()
    if reg is None:
        raise HTTPException(404, "Registration not found")
    payment = core.get_registration_payment(db, event_id, user.id)
    if payment:
        db.delete(payment)
    db.delete(reg)
    db.commit()
    return {"status": "unsubscribed"}


@router.post("/auth/logout", status_code=204)
def logout(authorization: str | None = Header(None), user=Depends(current_user),
           db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(authorization[7:].strip().encode()).hexdigest()
    db.query(WebSession).filter_by(token_hash=token_hash, user_id=user.id).delete()
    db.commit()


def install(app):
    # Importing the models before this call allows create_all to create the new tables.
    # Existing users.telegram_id still requires the explicit SQL migration.
    from db.session import engine
    Base.metadata.create_all(bind=engine)
    app.include_router(router)
