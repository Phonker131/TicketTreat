from __future__ import annotations

import base64
import binascii
import hashlib
import os
import secrets
import threading
import json
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Session

from db import models
from db.base import Base
from db.session import SessionLocal, engine, get_db
from demo_accounts import WebAccount, WebSession, install_demo_accounts
from demo_account_recovery import VerifiedEmail, EmailChallenge, install_email_account_security
from demo_telegram import DemoTelegramIdentity, install_telegram_auth, verified_telegram_id_for_guest, send_miniapp_ticket_notice
from demo_geography import DemoAccountPlace, DemoEventPlace, place_dict
from demo_roles import WebAccountRole, EventOwnership, EventModerationLog, install_demo_roles, install_account_moderation
from demo_email import EmailOutbox, queue_email, queue_event_reminder, ticket_language, install_email_worker, enabled as email_enabled, configured as email_configured


# =========================================================
# Existing project models
# =========================================================
User = models.User
Event = models.Event

Registration = (
    getattr(models, "Registration", None)
    or getattr(models, "EventRegistration", None)
    or getattr(models, "EventParticipant", None)
)

if Registration is None:
    raise ImportError(
        "Could not find the registrations SQLAlchemy model. "
        "Expected Registration, EventRegistration, or EventParticipant "
        "inside db.models."
    )


# =========================================================
# New payment tables
# =========================================================
# These are intentionally separate from your existing Event/Registration
# tables, so you do NOT need to replace db/models.py for this feature.
class EventPaymentSettings(Base):
    __tablename__ = "event_payment_settings"

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, unique=True, index=True)
    payment_instructions = Column(Text, nullable=False)


class RegistrationPayment(Base):
    __tablename__ = "registration_payments"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "user_id",
            name="uq_registration_payment_event_user",
        ),
    )

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    payment_status = Column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    payment_deadline = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    payment_confirmed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    payment_confirmed_by = Column(
        BigInteger,
        nullable=True,
    )


# =========================================================
# Language tables
# =========================================================
# Language settings are kept in separate tables so the existing
# User/Event SQLAlchemy models do not need to be changed.
class UserLanguageSetting(Base):
    __tablename__ = "user_language_settings"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(
        BigInteger,
        nullable=False,
        unique=True,
        index=True,
    )
    language = Column(
        String(2),
        nullable=False,
        default="ru",
        server_default="ru",
    )


class EventLanguageSetting(Base):
    __tablename__ = "event_language_settings"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "language",
            name="uq_event_language_event_language",
        ),
    )

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    language = Column(String(2), nullable=False)


# =========================================================
# Demo web/PWA tables
# =========================================================
# These tables power the showcase MVP. No real payment provider is
# contacted: checkout is completed immediately and a QR ticket is issued.
class DemoGuest(Base):
    __tablename__ = "demo_guests"

    id = Column(Integer, primary_key=True)
    access_token = Column(String(64), nullable=False, unique=True, index=True)
    telegram_id = Column(BigInteger, nullable=True, index=True)
    username = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class DemoTicket(Base):
    __tablename__ = "demo_tickets"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "guest_id",
            name="uq_demo_ticket_event_guest",
        ),
    )

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    guest_id = Column(Integer, nullable=False, index=True)
    qr_token = Column(String(80), nullable=False, unique=True, index=True)
    ticket_status = Column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
    )
    payment_status = Column(
        String(20),
        nullable=False,
        default="paid",
        server_default="paid",
    )
    payment_provider = Column(
        String(20),
        nullable=False,
        default="demo",
        server_default="demo",
    )
    payment_amount = Column(String(32), nullable=False, default="0")
    currency = Column(String(3), nullable=False, default="CZK")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)


class DemoWaitlist(Base):
    __tablename__ = "demo_waitlist"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "guest_id",
            name="uq_demo_waitlist_event_guest",
        ),
    )

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, nullable=False, index=True)
    guest_id = Column(Integer, nullable=False, index=True)
    status = Column(
        String(20),
        nullable=False,
        default="waiting",
        server_default="waiting",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    promoted_at = Column(DateTime(timezone=True), nullable=True)



class DemoEventPoster(Base):
    """Small, durable demo posters. Use object storage for larger production media."""
    __tablename__ = "demo_event_posters"

    event_id = Column(Integer, primary_key=True)
    content_type = Column(String(32), nullable=False)
    image_bytes = Column(LargeBinary, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


# Creates only tables that do not already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Crowdly API")


def configured_frontend_origins() -> list[str]:
    origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    raw_origins = os.getenv("FRONTEND_ORIGINS", "")

    for raw_value in raw_origins.split(","):
        origin = raw_value.strip().rstrip("/")
        if origin and origin not in origins:
            origins.append(origin)

    web_app_url = os.getenv("WEB_APP_URL", "").strip()

    if web_app_url:
        parsed = urlsplit(web_app_url)

        if parsed.scheme and parsed.netloc:
            origin = f"{parsed.scheme}://{parsed.netloc}"

            if origin not in origins:
                origins.append(origin)

    return origins


FRONTEND_ORIGINS = configured_frontend_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

PRAGUE_TZ = ZoneInfo("Europe/Prague")
PAYMENT_CONFIRMATION_HOURS = 24
DEMO_PAYMENT_MODE = os.getenv("DEMO_PAYMENT_MODE", "true").strip().lower() in {"1", "true", "yes", "on"}
DEMO_ADMIN_KEY = os.getenv("DEMO_ADMIN_KEY", "").strip()
DEMO_ISOLATED_API = os.getenv("DEMO_ISOLATED_API", "false").strip().lower() in {"1", "true", "yes", "on"}


@app.middleware("http")
async def isolate_showcase_api(request, call_next):
    """Allow demo routes and public event discovery, not legacy private APIs."""
    if not DEMO_ISOLATED_API or request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    safe_read = (
        request.method == "GET"
        and (
            path in {"/", "/events", "/docs", "/openapi.json"}
            or (path.startswith("/events/") and path.removeprefix("/events/").isdigit())
        )
    )
    # The old shared admin key is unsafe for multi-tenant organizer permissions.
    # These legacy endpoints stay unavailable on the public Demo API.
    if path.startswith("/demo/admin/"):
        return JSONResponse(status_code=403, content={"detail": "legacy_admin_disabled_use_account_login"})
    if path.startswith("/demo/") or safe_read:
        return await call_next(request)

    return JSONResponse(status_code=403, content={"detail": "demo_api_restricted"})



# =========================================================
# Pydantic models
# =========================================================
class Currency(str, Enum):
    CZK = "CZK"
    EUR = "EUR"
    USD = "USD"


class LanguageCode(str, Enum):
    EN = "en"
    CS = "cs"
    RU = "ru"
    UK = "uk"


class ProfileCreate(BaseModel):
    telegram_id: int
    username: str | None = None
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=30)
    contact_preference: str
    instagram: str | None = Field(default=None, max_length=255)


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    last_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    phone: str | None = Field(
        default=None,
        min_length=5,
        max_length=30,
    )
    contact_preference: str | None = None
    instagram: str | None = Field(
        default=None,
        max_length=255,
    )


class UserLanguageUpdate(BaseModel):
    language: LanguageCode


class EventLanguagesUpdate(BaseModel):
    languages: list[LanguageCode]


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    organizer: str | None = None
    location: str | None = None
    description: str | None = None

    max_participants: int | None = Field(
        default=None,
        ge=1,
    )

    price: Decimal | None = Field(
        default=None,
        ge=0,
    )
    currency: Currency = Currency.CZK

    payment_instructions: str | None = None
    languages: list[LanguageCode] = Field(default_factory=list)

    image_url: str | None = None
    starts_at: datetime | None = None
    telegram_photo_file_id: str | None = None

    reminder_minutes_before: int | None = Field(
        default=None,
        ge=1,
    )
    reminder_text: str | None = None



class DemoEventCreate(EventCreate):
    poster_data_url: str | None = Field(default=None, max_length=5700000)


class EventUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    organizer: str | None = None
    location: str | None = None
    description: str | None = None

    max_participants: int | None = Field(
        default=None,
        ge=1,
    )

    price: Decimal | None = Field(
        default=None,
        ge=0,
    )
    currency: Currency | None = None

    payment_instructions: str | None = None
    languages: list[LanguageCode] | None = None

    image_url: str | None = None
    starts_at: datetime | None = None
    telegram_photo_file_id: str | None = None

    reminder_minutes_before: int | None = Field(
        default=None,
        ge=1,
    )
    reminder_text: str | None = None


class EventRegistrationCreate(BaseModel):
    telegram_id: int
    username: str | None = None
    first_name: str | None = None


class EventCancellationCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class PaymentConfirmationCreate(BaseModel):
    admin_telegram_id: int


class DemoGuestCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    telegram_id: int | None = None
    username: str | None = Field(default=None, max_length=255)


class DemoCheckoutCreate(BaseModel):
    guest_token: str = Field(min_length=16, max_length=128)
    language: str = Field(default="en", max_length=8)


class DemoWaitlistCreate(BaseModel):
    guest_token: str = Field(min_length=16, max_length=128)


# =========================================================
# Time / payment helpers
# =========================================================
def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def price_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def event_requires_payment(event: Any) -> bool:
    return price_decimal(getattr(event, "price", None)) > 0


def get_payment_settings(
    db: Session,
    event_id: int,
) -> EventPaymentSettings | None:
    return (
        db.query(EventPaymentSettings)
        .filter(EventPaymentSettings.event_id == event_id)
        .first()
    )


def get_registration_payment(
    db: Session,
    event_id: int,
    user_id: int,
) -> RegistrationPayment | None:
    return (
        db.query(RegistrationPayment)
        .filter(
            RegistrationPayment.event_id == event_id,
            RegistrationPayment.user_id == user_id,
        )
        .first()
    )


def payment_record_is_expired(
    payment: RegistrationPayment,
) -> bool:
    deadline = normalize_aware_utc(payment.payment_deadline)

    return bool(
        payment.payment_status == "pending"
        and deadline is not None
        and deadline <= utc_now()
    )


def payment_state_for_registration(
    db: Session,
    event: Any,
    user_id: int,
) -> dict[str, Any]:
    payment_required = event_requires_payment(event)

    if not payment_required:
        return {
            "payment_required": False,
            "payment_status": "confirmed",
            "payment_deadline": None,
            "payment_confirmed_at": None,
            "payment_confirmed_by": None,
        }

    payment = get_registration_payment(
        db,
        event.id,
        user_id,
    )

    # Existing registrations created before this feature are preserved
    # as valid/confirmed registrations.
    if payment is None:
        return {
            "payment_required": True,
            "payment_status": "confirmed",
            "payment_deadline": None,
            "payment_confirmed_at": None,
            "payment_confirmed_by": None,
        }

    return {
        "payment_required": True,
        "payment_status": payment.payment_status,
        "payment_deadline": payment.payment_deadline,
        "payment_confirmed_at": payment.payment_confirmed_at,
        "payment_confirmed_by": payment.payment_confirmed_by,
    }


def registration_response(
    *,
    status: str,
    db: Session,
    event: Any,
    user_id: int,
    registered_count: int | None = None,
) -> dict[str, Any]:
    payment_state = payment_state_for_registration(
        db,
        event,
        user_id,
    )

    result: dict[str, Any] = {
        "status": status,
        "event_id": event.id,
        "title": event.title,
        "price": (
            str(event.price)
            if event.price is not None
            else None
        ),
        "currency": getattr(event, "currency", None) or "CZK",
        **payment_state,
    }

    if payment_state["payment_status"] == "pending":
        settings = get_payment_settings(
            db,
            event.id,
        )
        result["payment_instructions"] = (
            settings.payment_instructions
            if settings
            else None
        )

    if registered_count is not None:
        result["registered_count"] = registered_count

        if event.max_participants is None:
            result["spots_left"] = None
        else:
            result["spots_left"] = max(
                event.max_participants - registered_count,
                0,
            )

    return result


# =========================================================
# Language helpers
# =========================================================
SUPPORTED_LANGUAGE_CODES = {"en", "cs", "ru", "uk"}
DEFAULT_INTERFACE_LANGUAGE = "ru"


def normalize_language_code(value: Any) -> str | None:
    if isinstance(value, LanguageCode):
        value = value.value

    normalized = str(value or "").strip().lower()

    if normalized not in SUPPORTED_LANGUAGE_CODES:
        return None

    return normalized


def get_user_language_setting(
    db: Session,
    telegram_id: int,
) -> UserLanguageSetting | None:
    return (
        db.query(UserLanguageSetting)
        .filter(UserLanguageSetting.telegram_id == telegram_id)
        .first()
    )


def get_user_language(
    db: Session,
    telegram_id: int,
) -> str:
    setting = get_user_language_setting(db, telegram_id)

    if setting is None:
        return DEFAULT_INTERFACE_LANGUAGE

    return (
        normalize_language_code(setting.language)
        or DEFAULT_INTERFACE_LANGUAGE
    )


def set_user_language(
    db: Session,
    telegram_id: int,
    language: Any,
) -> str:
    normalized = normalize_language_code(language)

    if normalized is None:
        raise ValueError("unsupported_language")

    setting = get_user_language_setting(db, telegram_id)

    if setting is None:
        setting = UserLanguageSetting(
            telegram_id=telegram_id,
            language=normalized,
        )
        db.add(setting)
    else:
        setting.language = normalized

    return normalized


def get_event_languages(
    db: Session,
    event_id: int,
) -> list[str]:
    rows = (
        db.query(EventLanguageSetting)
        .filter(EventLanguageSetting.event_id == event_id)
        .order_by(EventLanguageSetting.id.asc())
        .all()
    )

    result: list[str] = []

    for row in rows:
        normalized = normalize_language_code(row.language)

        if normalized and normalized not in result:
            result.append(normalized)

    return result


def normalize_language_list(values: list[Any] | None) -> list[str]:
    result: list[str] = []

    for value in values or []:
        normalized = normalize_language_code(value)

        if normalized and normalized not in result:
            result.append(normalized)

    return result


def set_event_languages(
    db: Session,
    event_id: int,
    languages: list[Any],
) -> list[str]:
    normalized = normalize_language_list(languages)

    (
        db.query(EventLanguageSetting)
        .filter(EventLanguageSetting.event_id == event_id)
        .delete(synchronize_session=False)
    )

    for language in normalized:
        db.add(
            EventLanguageSetting(
                event_id=event_id,
                language=language,
            )
        )

    return normalized


# =========================================================
# General helpers
# =========================================================
def calculate_profile_complete(user: Any) -> bool:
    complete = bool(
        user.first_name
        and user.last_name
        and user.phone
        and user.contact_preference
    )

    if user.contact_preference == "instagram":
        complete = complete and bool(user.instagram)

    return complete


def normalize_contact_preference(value: str) -> str | None:
    normalized = value.strip().lower()

    if normalized not in {"telegram", "instagram"}:
        return None

    return normalized


def user_to_dict(user: Any) -> dict[str, Any]:
    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "contact_preference": user.contact_preference,
        "instagram": user.instagram,
    }


def get_registered_count(
    db: Session,
    event_id: int,
) -> int:
    telegram_count = (
        db.query(func.count(Registration.id))
        .filter(Registration.event_id == event_id)
        .scalar()
        or 0
    )

    demo_count = (
        db.query(func.count(DemoTicket.id))
        .filter(
            DemoTicket.event_id == event_id,
            DemoTicket.ticket_status == "active",
        )
        .scalar()
        or 0
    )

    return int(telegram_count) + int(demo_count)


def normalize_event_datetime(value: datetime) -> datetime:
    """
    Existing naive event timestamps are treated as Prague local time.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=PRAGUE_TZ)

    return value.astimezone(PRAGUE_TZ)


def event_is_past(event: Any) -> bool:
    if event.starts_at is None:
        return False

    starts_at = normalize_event_datetime(event.starts_at)
    return starts_at <= datetime.now(PRAGUE_TZ)


def event_has_started(event: Any) -> bool:
    return event_is_past(event)


def event_to_dict(
    event: Any,
    *,
    db: Session | None = None,
    registered_count: int | None = None,
    registration_user_id: int | None = None,
) -> dict[str, Any]:
    settings = (
        get_payment_settings(db, event.id)
        if db is not None
        else None
    )

    data: dict[str, Any] = {
        "id": event.id,
        "title": event.title,
        "organizer": event.organizer,
        "location": event.location,
        "description": event.description,
        "max_participants": event.max_participants,
        "price": (
            str(event.price)
            if event.price is not None
            else None
        ),
        "currency": getattr(event, "currency", None) or "CZK",
        "languages": (
            get_event_languages(db, event.id)
            if db is not None
            else []
        ),
        "payment_required": event_requires_payment(event),
        "payment_instructions_configured": bool(
            settings
            and settings.payment_instructions.strip()
        ),
        "image_url": getattr(event, "image_url", None),
        "starts_at": event.starts_at,
        "telegram_photo_file_id": getattr(
            event,
            "telegram_photo_file_id",
            None,
        ),
        "reminder_minutes_before": getattr(
            event,
            "reminder_minutes_before",
            None,
        ),
        "reminder_text": getattr(
            event,
            "reminder_text",
            None,
        ),
        "reminder_sent": bool(
            getattr(event, "reminder_sent", False)
        ),
        "is_cancelled": bool(
            getattr(event, "is_cancelled", False)
        ),
        "cancellation_reason": getattr(
            event,
            "cancellation_reason",
            None,
        ),
        "cancelled_at": getattr(
            event,
            "cancelled_at",
            None,
        ),
    }

    if db is not None:
        data.update(place_dict(db, DemoEventPlace, "event_id", event.id))
        from demo_roles import EventMedia
        media = db.query(EventMedia).filter(EventMedia.event_id == event.id).first()
        data["gallery_urls"] = json.loads(media.gallery_json or "[]") if media else []
        data["video_url"] = media.video_url if media else None
    else:
        data.update({"country_code": None, "city": None})

    if registered_count is not None:
        data["registered_count"] = registered_count

        if event.max_participants is None:
            data["spots_left"] = None
        else:
            data["spots_left"] = max(
                event.max_participants - registered_count,
                0,
            )

    if (
        db is not None
        and registration_user_id is not None
    ):
        data.update(
            payment_state_for_registration(
                db,
                event,
                registration_user_id,
            )
        )

    return data


def apply_existing_event_fields(
    event: Any,
    values: dict[str, Any],
) -> None:
    for field, value in values.items():
        if hasattr(Event, field):
            setattr(event, field, value)


# =========================================================
# Payment cleanup worker
# =========================================================
_payment_cleanup_started = False
_payment_cleanup_lock = threading.Lock()


def payment_cleanup_worker():
    print("PAYMENT CLEANUP WORKER STARTED")

    while True:
        db = SessionLocal()

        try:
            now = utc_now()

            expired = (
                db.query(RegistrationPayment)
                .filter(
                    RegistrationPayment.payment_status == "pending",
                    RegistrationPayment.payment_deadline.isnot(None),
                    RegistrationPayment.payment_deadline <= now,
                )
                .all()
            )

            removed = 0

            for payment in expired:
                registration = (
                    db.query(Registration)
                    .filter(
                        Registration.user_id == payment.user_id,
                        Registration.event_id == payment.event_id,
                    )
                    .first()
                )

                if registration is not None:
                    db.delete(registration)
                    removed += 1

                db.delete(payment)

            db.commit()

            if removed:
                print(
                    f"PAYMENT CLEANUP: removed {removed} "
                    "expired registration(s)"
                )

        except Exception as error:
            db.rollback()
            print("[PAYMENT CLEANUP ERROR]", repr(error))

        finally:
            db.close()

        time.sleep(60)


@app.on_event("startup")
def start_payment_cleanup_worker():
    global _payment_cleanup_started

    if DEMO_ISOLATED_API:
        return

    with _payment_cleanup_lock:
        if _payment_cleanup_started:
            return

        _payment_cleanup_started = True

        threading.Thread(
            target=payment_cleanup_worker,
            daemon=True,
        ).start()


# =========================================================
# Basic
# =========================================================
@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Crowdly API",
    }


# =========================================================
# Profiles / users
# =========================================================
@app.post("/profile")
def save_profile(
    payload: ProfileCreate,
    db: Session = Depends(get_db),
):
    contact_preference = normalize_contact_preference(
        payload.contact_preference
    )

    if contact_preference is None:
        return {
            "error": "invalid_contact_preference",
        }

    instagram = (
        payload.instagram.strip()
        if payload.instagram
        else None
    )

    if (
        contact_preference == "instagram"
        and not instagram
    ):
        return {
            "error": "instagram_required",
        }

    user = (
        db.query(User)
        .filter(User.telegram_id == payload.telegram_id)
        .first()
    )

    if user is None:
        user = User(
            telegram_id=payload.telegram_id,
        )
        db.add(user)

    user.username = payload.username
    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    user.phone = payload.phone.strip()
    user.contact_preference = contact_preference
    user.instagram = instagram

    db.commit()
    db.refresh(user)

    return {
        "status": "saved",
        "exists": True,
        "complete": calculate_profile_complete(user),
        "language": get_user_language(db, user.telegram_id),
        **user_to_dict(user),
    }


@app.get("/profile/{telegram_id}")
def get_profile(
    telegram_id: int,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.telegram_id == telegram_id)
        .first()
    )

    if user is None:
        return {
            "exists": False,
            "complete": False,
            "telegram_id": telegram_id,
            "username": None,
            "first_name": None,
            "last_name": None,
            "phone": None,
            "contact_preference": None,
            "instagram": None,
            "language": get_user_language(db, telegram_id),
        }

    return {
        "exists": True,
        "complete": calculate_profile_complete(user),
        "language": get_user_language(db, telegram_id),
        **user_to_dict(user),
    }


@app.patch("/profile/{telegram_id}")
def update_profile(
    telegram_id: int,
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.telegram_id == telegram_id)
        .first()
    )

    if user is None:
        return {
            "error": "profile_not_found",
        }

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if not update_data:
        return {
            "status": "no_changes",
            "exists": True,
            "complete": calculate_profile_complete(user),
            "language": get_user_language(db, telegram_id),
            **user_to_dict(user),
        }

    if "contact_preference" in update_data:
        raw_contact_preference = (
            update_data["contact_preference"]
            or ""
        )

        contact_preference = normalize_contact_preference(
            raw_contact_preference
        )

        if contact_preference is None:
            return {
                "error": "invalid_contact_preference",
            }

        update_data[
            "contact_preference"
        ] = contact_preference

    for field in {
        "first_name",
        "last_name",
        "phone",
    }:
        if field not in update_data:
            continue

        value = update_data[field]

        if value is not None:
            value = value.strip()

        if not value:
            return {
                "error": f"{field}_cannot_be_empty",
            }

        update_data[field] = value

    if "instagram" in update_data:
        instagram = update_data["instagram"]

        if instagram is not None:
            instagram = instagram.strip()

        update_data["instagram"] = instagram or None

    resulting_contact_preference = update_data.get(
        "contact_preference",
        user.contact_preference,
    )

    resulting_instagram = update_data.get(
        "instagram",
        user.instagram,
    )

    if (
        resulting_contact_preference == "instagram"
        and not resulting_instagram
    ):
        return {
            "error": "instagram_required",
        }

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return {
        "status": "updated",
        "exists": True,
        "complete": calculate_profile_complete(user),
        "language": get_user_language(db, telegram_id),
        **user_to_dict(user),
    }


@app.get("/users/{telegram_id}/language")
def get_interface_language(
    telegram_id: int,
    db: Session = Depends(get_db),
):
    setting = get_user_language_setting(
        db,
        telegram_id,
    )

    return {
        "telegram_id": telegram_id,
        "language": (
            normalize_language_code(setting.language)
            if setting is not None
            else DEFAULT_INTERFACE_LANGUAGE
        ),
        "explicit": setting is not None,
    }


@app.put("/users/{telegram_id}/language")
def update_interface_language(
    telegram_id: int,
    payload: UserLanguageUpdate,
    db: Session = Depends(get_db),
):
    language = set_user_language(
        db,
        telegram_id,
        payload.language,
    )

    db.commit()

    return {
        "status": "updated",
        "telegram_id": telegram_id,
        "language": language,
    }


@app.get("/users")
def list_users(
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .order_by(User.id.asc())
        .all()
    )

    return [
        user_to_dict(user)
        for user in users
    ]


# =========================================================
# Events
# =========================================================
@app.post("/events")
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
):
    payment_instructions = (
        payload.payment_instructions.strip()
        if payload.payment_instructions
        else None
    )

    event_languages = normalize_language_list(
        payload.languages
    )

    if not event_languages:
        return {
            "error": "event_languages_required",
        }

    if (
        price_decimal(payload.price) > 0
        and not payment_instructions
    ):
        return {
            "error": "payment_setup_missing",
        }

    event = Event()

    values = {
        "title": payload.title.strip(),
        "organizer": payload.organizer,
        "location": payload.location,
        "description": payload.description,
        "max_participants": payload.max_participants,
        "price": payload.price,
        "currency": payload.currency.value,
        "image_url": payload.image_url,
        "starts_at": payload.starts_at,
        "telegram_photo_file_id": (
            payload.telegram_photo_file_id
        ),
        "reminder_minutes_before": (
            payload.reminder_minutes_before
        ),
        "reminder_text": payload.reminder_text,
        "reminder_sent": False,
        "is_cancelled": False,
    }

    apply_existing_event_fields(
        event,
        values,
    )

    db.add(event)
    db.flush()

    set_event_languages(
        db,
        event.id,
        event_languages,
    )

    if payment_instructions:
        db.add(
            EventPaymentSettings(
                event_id=event.id,
                payment_instructions=payment_instructions,
            )
        )

    db.commit()
    db.refresh(event)

    return event_to_dict(
        event,
        db=db,
        registered_count=0,
    )


@app.get("/events")
def list_events(
    include_past: bool = False,
    db: Session = Depends(get_db),
):
    events = (
        db.query(Event)
        .order_by(
            Event.starts_at.asc().nullslast(),
            Event.id.asc(),
        )
        .all()
    )

    if not include_past:
        events = [
            event
            for event in events
            if event.starts_at is not None
            and not getattr(
                event,
                "is_cancelled",
                False,
            )
            and not event_is_past(event)
        ]

    return [
        event_to_dict(
            event,
            db=db,
            registered_count=get_registered_count(
                db,
                event.id,
            ),
        )
        for event in events
    ]


@app.get("/events/{event_id}")
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    return event_to_dict(
        event,
        db=db,
        registered_count=get_registered_count(
            db,
            event.id,
        ),
    )


@app.patch("/events/{event_id}")
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    update_data = payload.model_dump(
        exclude_unset=True
    )

    languages_were_set = "languages" in update_data
    language_values = update_data.pop(
        "languages",
        None,
    )

    normalized_event_languages: list[str] | None = None

    if languages_were_set:
        normalized_event_languages = normalize_language_list(
            language_values
        )

        if not normalized_event_languages:
            return {
                "error": "event_languages_required",
            }

    payment_instructions_was_set = (
        "payment_instructions" in update_data
    )

    payment_instructions_value = update_data.pop(
        "payment_instructions",
        None,
    )

    current_settings = get_payment_settings(
        db,
        event.id,
    )

    current_instructions = (
        current_settings.payment_instructions.strip()
        if current_settings
        and current_settings.payment_instructions
        else None
    )

    if payment_instructions_was_set:
        new_instructions = (
            payment_instructions_value.strip()
            if payment_instructions_value
            else None
        )
    else:
        new_instructions = current_instructions

    effective_price = update_data.get(
        "price",
        event.price,
    )

    if (
        price_decimal(effective_price) > 0
        and not new_instructions
    ):
        return {
            "error": "payment_setup_missing",
        }

    if (
        "currency" in update_data
        and update_data["currency"] is not None
    ):
        currency = update_data["currency"]
        update_data["currency"] = (
            currency.value
            if isinstance(currency, Currency)
            else str(currency)
        )

    if "title" in update_data:
        update_data["title"] = (
            update_data["title"].strip()
        )

    reminder_fields = {
        "starts_at",
        "reminder_minutes_before",
        "reminder_text",
    }

    if reminder_fields.intersection(update_data):
        update_data["reminder_sent"] = False

    apply_existing_event_fields(
        event,
        update_data,
    )

    if languages_were_set:
        set_event_languages(
            db,
            event.id,
            normalized_event_languages or [],
        )

    if payment_instructions_was_set:
        if new_instructions:
            if current_settings is None:
                current_settings = EventPaymentSettings(
                    event_id=event.id,
                    payment_instructions=new_instructions,
                )
                db.add(current_settings)
            else:
                current_settings.payment_instructions = (
                    new_instructions
                )
        elif current_settings is not None:
            db.delete(current_settings)

    db.commit()
    db.refresh(event)

    return {
        "status": "updated",
        **event_to_dict(
            event,
            db=db,
            registered_count=get_registered_count(
                db,
                event.id,
            ),
        ),
    }


@app.put("/events/{event_id}/languages")
def update_event_languages(
    event_id: int,
    payload: EventLanguagesUpdate,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    languages = normalize_language_list(
        payload.languages
    )

    if not languages:
        return {
            "error": "event_languages_required",
        }

    set_event_languages(
        db,
        event.id,
        languages,
    )

    db.commit()

    return {
        "status": "updated",
        **event_to_dict(
            event,
            db=db,
            registered_count=get_registered_count(
                db,
                event.id,
            ),
        ),
    }


@app.post("/events/{event_id}/cancel")
def cancel_event(
    event_id: int,
    payload: EventCancellationCreate,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    if getattr(event, "is_cancelled", False):
        return {
            "status": "already_cancelled",
            **event_to_dict(
                event,
                db=db,
                registered_count=get_registered_count(
                    db,
                    event.id,
                ),
            ),
        }

    values = {
        "is_cancelled": True,
        "cancellation_reason": payload.reason.strip(),
        "cancelled_at": datetime.now(PRAGUE_TZ).replace(
            tzinfo=None
        ),
    }

    apply_existing_event_fields(
        event,
        values,
    )

    db.commit()
    db.refresh(event)

    return {
        "status": "cancelled",
        **event_to_dict(
            event,
            db=db,
            registered_count=get_registered_count(
                db,
                event.id,
            ),
        ),
    }


@app.post("/events/{event_id}/reminder-sent")
def mark_reminder_sent(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    if hasattr(Event, "reminder_sent"):
        event.reminder_sent = True

    db.commit()

    return {
        "status": "reminder_marked_sent",
    }


# =========================================================
# Event registrations / payments
# =========================================================
@app.post("/events/{event_id}/register")
def register_to_event(
    event_id: int,
    payload: EventRegistrationCreate,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    if getattr(event, "is_cancelled", False):
        return {
            "error": "event_cancelled",
        }

    if event.starts_at is None:
        return {
            "error": "event_has_no_start_time",
        }

    if event_has_started(event):
        return {
            "error": "event_already_started",
        }

    if event_requires_payment(event):
        settings = get_payment_settings(
            db,
            event.id,
        )

        if (
            settings is None
            or not settings.payment_instructions.strip()
        ):
            return {
                "error": "payment_setup_missing",
            }

    user = (
        db.query(User)
        .filter(
            User.telegram_id
            == payload.telegram_id
        )
        .first()
    )

    if user is None:
        return {
            "error": "profile_not_found",
        }

    if payload.username is not None:
        user.username = payload.username

    if (
        payload.first_name
        and not user.first_name
    ):
        user.first_name = payload.first_name

    existing_registration = (
        db.query(Registration)
        .filter(
            Registration.user_id == user.id,
            Registration.event_id == event.id,
        )
        .first()
    )

    if existing_registration is not None:
        return registration_response(
            status="already_registered",
            db=db,
            event=event,
            user_id=user.id,
            registered_count=get_registered_count(
                db,
                event.id,
            ),
        )

    registered_count = get_registered_count(
        db,
        event.id,
    )

    if (
        event.max_participants is not None
        and registered_count
        >= event.max_participants
    ):
        return {
            "error": "event_full",
        }

    registration = Registration(
        user_id=user.id,
        event_id=event.id,
    )

    db.add(registration)

    if event_requires_payment(event):
        payment = RegistrationPayment(
            event_id=event.id,
            user_id=user.id,
            payment_status="pending",
            payment_deadline=(
                utc_now()
                + timedelta(
                    hours=PAYMENT_CONFIRMATION_HOURS
                )
            ),
        )
        db.add(payment)

    db.commit()

    return registration_response(
        status="registered",
        db=db,
        event=event,
        user_id=user.id,
        registered_count=registered_count + 1,
    )


@app.get(
    "/events/{event_id}/payment-info/{telegram_id}"
)
def get_payment_info(
    event_id: int,
    telegram_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    user = (
        db.query(User)
        .filter(User.telegram_id == telegram_id)
        .first()
    )

    if user is None:
        return {
            "error": "profile_not_found",
        }

    registration = (
        db.query(Registration)
        .filter(
            Registration.user_id == user.id,
            Registration.event_id == event.id,
        )
        .first()
    )

    if registration is None:
        return {
            "error": "not_registered",
        }

    if not event_requires_payment(event):
        return {
            "error": "payment_not_required",
        }

    settings = get_payment_settings(
        db,
        event.id,
    )

    if (
        settings is None
        or not settings.payment_instructions.strip()
    ):
        return {
            "error": "payment_setup_missing",
        }

    result = registration_response(
        status="already_registered",
        db=db,
        event=event,
        user_id=user.id,
        registered_count=get_registered_count(
            db,
            event.id,
        ),
    )

    result["payment_instructions"] = (
        settings.payment_instructions
    )

    return result


@app.post(
    "/events/{event_id}/participants/"
    "{telegram_id}/confirm-payment"
)
def confirm_payment(
    event_id: int,
    telegram_id: int,
    payload: PaymentConfirmationCreate,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return {
            "error": "event_not_found",
        }

    user = (
        db.query(User)
        .filter(User.telegram_id == telegram_id)
        .first()
    )

    if user is None:
        return {
            "error": "profile_not_found",
        }

    registration = (
        db.query(Registration)
        .filter(
            Registration.user_id == user.id,
            Registration.event_id == event.id,
        )
        .first()
    )

    if registration is None:
        return {
            "error": "registration_not_found",
        }

    if not event_requires_payment(event):
        return {
            "status": "already_confirmed",
            "title": event.title,
            "telegram_id": telegram_id,
        }

    payment = get_registration_payment(
        db,
        event.id,
        user.id,
    )

    # Legacy registration from before the payment feature.
    if payment is None:
        return {
            "status": "already_confirmed",
            "title": event.title,
            "telegram_id": telegram_id,
        }

    if payment.payment_status == "confirmed":
        return {
            "status": "already_confirmed",
            "title": event.title,
            "telegram_id": telegram_id,
        }

    if payment_record_is_expired(payment):
        db.delete(registration)
        db.delete(payment)
        db.commit()

        return {
            "error": "payment_deadline_expired",
        }

    payment.payment_status = "confirmed"
    payment.payment_deadline = None
    payment.payment_confirmed_at = utc_now()
    payment.payment_confirmed_by = (
        payload.admin_telegram_id
    )

    db.commit()
    db.refresh(payment)

    return {
        "status": "confirmed",
        "title": event.title,
        "telegram_id": telegram_id,
        "payment_status": payment.payment_status,
        "payment_confirmed_at": (
            payment.payment_confirmed_at
        ),
        "payment_confirmed_by": (
            payment.payment_confirmed_by
        ),
    }


@app.delete(
    "/events/{event_id}/register/{telegram_id}"
)
def unsubscribe_from_event(
    event_id: int,
    telegram_id: int,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(
            User.telegram_id == telegram_id
        )
        .first()
    )

    if user is None:
        return {
            "status": "not_registered",
        }

    registration = (
        db.query(Registration)
        .filter(
            Registration.user_id == user.id,
            Registration.event_id == event_id,
        )
        .first()
    )

    if registration is None:
        return {
            "status": "not_registered",
        }

    payment = get_registration_payment(
        db,
        event_id,
        user.id,
    )

    if payment is not None:
        db.delete(payment)

    db.delete(registration)
    db.commit()

    return {
        "status": "unsubscribed",
    }


@app.get("/events/{event_id}/participants")
def get_event_participants(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return []

    rows = (
        db.query(User, Registration)
        .join(
            Registration,
            Registration.user_id == User.id,
        )
        .filter(
            Registration.event_id == event_id
        )
        .order_by(User.id.asc())
        .all()
    )

    result = []

    for user, registration in rows:
        item = user_to_dict(user)
        item.update(
            payment_state_for_registration(
                db,
                event,
                user.id,
            )
        )
        result.append(item)

    return result


@app.get("/users/{telegram_id}/events")
def get_user_events(
    telegram_id: int,
    include_past: bool = False,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(
            User.telegram_id == telegram_id
        )
        .first()
    )

    if user is None:
        return []

    events = (
        db.query(Event)
        .join(
            Registration,
            Registration.event_id == Event.id,
        )
        .filter(
            Registration.user_id == user.id
        )
        .order_by(
            Event.starts_at.asc().nullslast(),
            Event.id.asc(),
        )
        .all()
    )

    if not include_past:
        events = [
            event
            for event in events
            if event.starts_at is not None
            and not getattr(
                event,
                "is_cancelled",
                False,
            )
            and not event_is_past(event)
        ]

    return [
        event_to_dict(
            event,
            db=db,
            registered_count=get_registered_count(
                db,
                event.id,
            ),
            registration_user_id=user.id,
        )
        for event in events
    ]


# =========================================================
# Demo Web/PWA showcase API
# =========================================================
def demo_guest_to_dict(
    guest: DemoGuest,
    db: Session | None = None,
) -> dict[str, Any]:
    visits = 0

    if db is not None:
        visits = (
            db.query(func.count(DemoTicket.id))
            .filter(
                DemoTicket.guest_id == guest.id,
                DemoTicket.checked_in_at.isnot(None),
                DemoTicket.ticket_status == "active",
            )
            .scalar()
            or 0
        )

    return {
        "id": guest.id,
        "access_token": guest.access_token,
        "telegram_id": guest.telegram_id,
        "username": guest.username,
        "first_name": guest.first_name,
        "last_name": guest.last_name,
        "email": guest.email,
        "visits": int(visits),
    }


def get_demo_guest_by_token(
    db: Session,
    access_token: str,
) -> DemoGuest | None:
    return (
        db.query(DemoGuest)
        .filter(DemoGuest.access_token == access_token)
        .first()
    )


def ticket_code(ticket_id: int) -> str:
    return f"CRD-{ticket_id:06d}"


def demo_ticket_to_dict(
    ticket: DemoTicket,
    db: Session,
) -> dict[str, Any]:
    event = (
        db.query(Event)
        .filter(Event.id == ticket.event_id)
        .first()
    )
    guest = (
        db.query(DemoGuest)
        .filter(DemoGuest.id == ticket.guest_id)
        .first()
    )

    return {
        "id": ticket.id,
        "code": ticket_code(ticket.id),
        "event_id": ticket.event_id,
        "guest_id": ticket.guest_id,
        "qr_token": ticket.qr_token,
        "ticket_status": ticket.ticket_status,
        "payment_status": ticket.payment_status,
        "payment_provider": ticket.payment_provider,
        "payment_amount": ticket.payment_amount,
        "currency": ticket.currency,
        "created_at": ticket.created_at,
        "checked_in_at": ticket.checked_in_at,
        "cancelled_at": ticket.cancelled_at,
        "event": (
            event_to_dict(
                event,
                db=db,
                registered_count=get_registered_count(db, event.id),
            )
            if event is not None
            else None
        ),
        "guest": (
            demo_guest_to_dict(guest, db=db)
            if guest is not None
            else None
        ),
    }


def require_demo_admin(
    x_demo_admin_key: str | None = Header(default=None),
) -> str:
    if not DEMO_ADMIN_KEY or not x_demo_admin_key or not secrets.compare_digest(x_demo_admin_key, DEMO_ADMIN_KEY):
        raise HTTPException(
            status_code=401,
            detail="invalid_demo_admin_key",
        )

    return x_demo_admin_key


def promote_demo_waitlist(
    db: Session,
    event_id: int,
) -> DemoTicket | None:
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        return None

    if (
        event.max_participants is not None
        and get_registered_count(db, event_id) >= event.max_participants
    ):
        return None

    waitlist_entry = (
        db.query(DemoWaitlist)
        .filter(
            DemoWaitlist.event_id == event_id,
            DemoWaitlist.status == "waiting",
        )
        .order_by(DemoWaitlist.created_at.asc(), DemoWaitlist.id.asc())
        .first()
    )

    if waitlist_entry is None:
        return None

    existing = (
        db.query(DemoTicket)
        .filter(
            DemoTicket.event_id == event_id,
            DemoTicket.guest_id == waitlist_entry.guest_id,
        )
        .first()
    )

    if existing is not None:
        ticket = existing
        ticket.qr_token = secrets.token_urlsafe(32)
        ticket.ticket_status = "active"
        ticket.payment_status = "not_required" if price_decimal(event.price) <= 0 else "paid"
        ticket.payment_provider = "free" if price_decimal(event.price) <= 0 else "demo"
        ticket.payment_amount = str(price_decimal(event.price))
        ticket.currency = getattr(event, "currency", None) or "CZK"
        ticket.checked_in_at = None
        ticket.cancelled_at = None
    else:
        ticket = DemoTicket(
            event_id=event.id,
            guest_id=waitlist_entry.guest_id,
            qr_token=secrets.token_urlsafe(32),
            ticket_status="active",
            payment_status="not_required" if price_decimal(event.price) <= 0 else "paid",
            payment_provider="free" if price_decimal(event.price) <= 0 else "demo",
            payment_amount=str(price_decimal(event.price)),
            currency=getattr(event, "currency", None) or "CZK",
        )
        db.add(ticket)
    waitlist_entry.status = "promoted"
    waitlist_entry.promoted_at = utc_now()
    db.flush()
    return ticket


@app.get("/demo/admin/verify")
def demo_admin_verify(
    _admin_key: str = Depends(require_demo_admin),
):
    """Validate the demo admin secret without changing data."""
    return {"authenticated": True}



DEMO_POSTER_MAX_BYTES = 4 * 1024 * 1024
DEMO_POSTER_TYPES = {"image/jpeg", "image/png", "image/webp"}


def decode_demo_poster(data_url: str) -> tuple[str, bytes]:
    """Validate size, format and file signature, never accept active SVG content."""
    if len(data_url) > 5_700_000:
        raise HTTPException(status_code=413, detail="poster_too_large")

    try:
        prefix, encoded = data_url.split(",", 1)
        content_type = prefix.removeprefix("data:").removesuffix(";base64").lower()
        if (
            content_type not in DEMO_POSTER_TYPES
            or prefix.lower() != f"data:{content_type};base64"
        ):
            raise ValueError("unsupported_type")

        image_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="poster_invalid_image")

    if len(image_bytes) > DEMO_POSTER_MAX_BYTES or not image_bytes:
        raise HTTPException(status_code=413, detail="poster_too_large")

    valid = (
        (content_type == "image/jpeg" and image_bytes.startswith(bytes.fromhex("ffd8ff")))
        or (content_type == "image/png" and image_bytes.startswith(bytes.fromhex("89504e470d0a1a0a")))
        or (
            content_type == "image/webp"
            and image_bytes.startswith(b"RIFF")
            and image_bytes[8:12] == b"WEBP"
        )
    )
    if not valid:
        raise HTTPException(status_code=422, detail="poster_invalid_image")

    return content_type, image_bytes


@app.get("/demo/events/{event_id}/poster")
def get_demo_event_poster(event_id: int, db: Session = Depends(get_db)):
    poster = db.query(DemoEventPoster).filter(DemoEventPoster.event_id == event_id).first()
    if poster is None:
        raise HTTPException(status_code=404, detail="poster_not_found")
    return Response(
        content=poster.image_bytes,
        media_type=poster.content_type,
        headers={"Cache-Control": "public, max-age=300"},
    )


@app.post("/demo/admin/events")
def demo_admin_create_event(
    payload: DemoEventCreate,
    request: Request,
    _admin_key: str = Depends(require_demo_admin),
    db: Session = Depends(get_db),
):
    if not payload.languages:
        raise HTTPException(status_code=422, detail="event_languages_required")
    if payload.poster_data_url:
        content_type, image_bytes = decode_demo_poster(payload.poster_data_url)
    else:
        content_type, image_bytes = None, None

    result = create_event(payload=payload, db=db)
    if isinstance(result, dict) and result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])

    if image_bytes is not None and content_type is not None:
        event_id = result["id"]
        public_base = (
            os.getenv("DEMO_PUBLIC_API_URL", "").rstrip("/")
            or str(request.base_url).rstrip("/")
        )
        poster_url = f"{public_base}/demo/events/{event_id}/poster"

        db.add(DemoEventPoster(
            event_id=event_id,
            content_type=content_type,
            image_bytes=image_bytes,
        ))
        event = db.query(Event).filter(Event.id == event_id).first()
        if event is not None:
            event.image_url = poster_url
        db.commit()
        result = event_to_dict(
            event, db=db, registered_count=get_registered_count(db, event_id)
        )
    return result


@app.get("/demo/config")
def demo_config():
    return {
        "demo_payment_mode": DEMO_PAYMENT_MODE,
        "payment_provider": "demo",
        "real_money_charged": False,
    }


@app.post("/demo/guests")
def create_or_get_demo_guest(
    payload: DemoGuestCreate,
    db: Session = Depends(get_db),
):
    """Create an isolated demo guest. Email / Telegram ID are not verified.

    Never reuse or reveal an existing bearer token based on an unverified
    email or Telegram ID. The frontend keeps the token for this browser only.
    """
    email = payload.email.strip().lower() if payload.email else None
    if not email:
        raise HTTPException(status_code=422, detail="email_required")

    guest = DemoGuest(
        access_token=secrets.token_urlsafe(32),
        telegram_id=None,
        username=None,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip() if payload.last_name else None,
        email=email,
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return demo_guest_to_dict(guest, db=db)


@app.get("/demo/guests/{guest_token}")
def get_demo_guest(
    guest_token: str,
    db: Session = Depends(get_db),
):
    guest = get_demo_guest_by_token(db, guest_token)

    if guest is None:
        raise HTTPException(
            status_code=404,
            detail="demo_guest_not_found",
        )

    return demo_guest_to_dict(guest, db=db)


def telegram_guest_has_bot_registration(db: Session, guest: DemoGuest, event_id: int) -> bool:
    # A Telegram ID is trusted ONLY when linked through verified initData.
    if guest.telegram_id is None:
        return False
    link = db.query(DemoTelegramIdentity).filter(
        DemoTelegramIdentity.telegram_id == guest.telegram_id,
        DemoTelegramIdentity.guest_id == guest.id,
    ).first()
    if link is None:
        return False
    bot_user = db.query(User).filter(User.telegram_id == guest.telegram_id).first()
    if bot_user is None:
        return False
    return db.query(Registration.id).filter(
        Registration.event_id == event_id,
        Registration.user_id == bot_user.id,
    ).first() is not None


@app.post("/demo/events/{event_id}/checkout")
def demo_checkout(
    event_id: int,
    payload: DemoCheckoutCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # A genuinely free event never needs a payment provider.
    # Paid events still require explicit DEMO_PAYMENT_MODE until a real
    # licensed payment integration is activated.
    guest = get_demo_guest_by_token(db, payload.guest_token)

    if guest is None:
        raise HTTPException(
            status_code=404,
            detail="demo_guest_not_found",
        )

    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(status_code=404, detail="event_not_found")

    free_event = price_decimal(event.price) <= 0
    if not free_event and not DEMO_PAYMENT_MODE:
        raise HTTPException(status_code=503, detail="demo_payment_disabled")

    if getattr(event, "is_cancelled", False):
        raise HTTPException(status_code=409, detail="event_cancelled")

    if event.starts_at is None:
        raise HTTPException(status_code=409, detail="event_has_no_start_time")

    if event_has_started(event):
        raise HTTPException(status_code=409, detail="event_already_started")

    existing = (
        db.query(DemoTicket)
        .filter(
            DemoTicket.event_id == event_id,
            DemoTicket.guest_id == guest.id,
        )
        .first()
    )

    if existing is not None and existing.ticket_status == "active":
        return {
            "status": "already_registered" if free_event else "already_paid",
            "ticket": demo_ticket_to_dict(existing, db),
            "demo_payment": not free_event,
            "real_money_charged": False,
        }

    if telegram_guest_has_bot_registration(db, guest, event_id):
        raise HTTPException(status_code=409, detail="already_registered_via_bot")

    if (
        event.max_participants is not None
        and get_registered_count(db, event.id) >= event.max_participants
    ):
        raise HTTPException(status_code=409, detail="event_full")

    if existing is not None:
        ticket = existing
        ticket.qr_token = secrets.token_urlsafe(32)
        ticket.ticket_status = "active"
        ticket.payment_status = "not_required" if free_event else "paid"
        ticket.payment_provider = "free" if free_event else "demo"
        ticket.payment_amount = str(price_decimal(event.price))
        ticket.currency = getattr(event, "currency", None) or "CZK"
        ticket.checked_in_at = None
        ticket.cancelled_at = None
    else:
        ticket = DemoTicket(
            event_id=event.id,
            guest_id=guest.id,
            qr_token=secrets.token_urlsafe(32),
            ticket_status="active",
            payment_status="not_required" if free_event else "paid",
            payment_provider="free" if free_event else "demo",
            payment_amount=str(price_decimal(event.price)),
            currency=getattr(event, "currency", None) or "CZK",
        )
        db.add(ticket)

    waitlist_entry = (
        db.query(DemoWaitlist)
        .filter(
            DemoWaitlist.event_id == event.id,
            DemoWaitlist.guest_id == guest.id,
            DemoWaitlist.status == "waiting",
        )
        .first()
    )
    if waitlist_entry is not None:
        waitlist_entry.status = "promoted"
        waitlist_entry.promoted_at = utc_now()

    db.flush()
    queue_email(
        db, kind="ticket",
        event_key=f"ticket:{ticket.id}:issue:{hashlib.sha256(ticket.qr_token.encode()).hexdigest()[:20]}",
        recipient=guest.email, guest_id=guest.id, ticket_id=ticket.id,
        language=payload.language,
    )
    queue_event_reminder(db, event=event, guest=guest, ticket=ticket, language=payload.language)
    db.commit()
    db.refresh(ticket)

    # Signed Telegram Mini App users receive a QR-ticket link in the same bot
    # after successful booking. This is independent from bot long polling.
    telegram_id = verified_telegram_id_for_guest(db, guest.id)
    if telegram_id is not None:
        background_tasks.add_task(
            send_miniapp_ticket_notice, telegram_id, event.title, ticket.id, free_event, payload.language
        )

    return {
        "status": "registered" if free_event else "paid",
        "ticket": demo_ticket_to_dict(ticket, db),
        "demo_payment": not free_event,
        "real_money_charged": False,
    }


@app.post("/demo/events/{event_id}/waitlist")
def join_demo_waitlist(
    event_id: int,
    payload: DemoWaitlistCreate,
    db: Session = Depends(get_db),
):
    guest = get_demo_guest_by_token(db, payload.guest_token)

    if guest is None:
        raise HTTPException(
            status_code=404,
            detail="demo_guest_not_found",
        )

    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(status_code=404, detail="event_not_found")

    if telegram_guest_has_bot_registration(db, guest, event_id):
        raise HTTPException(status_code=409, detail="already_registered_via_bot")

    if event.max_participants is None:
        raise HTTPException(status_code=409, detail="waitlist_not_needed")

    if get_registered_count(db, event.id) < event.max_participants:
        raise HTTPException(status_code=409, detail="spots_available")

    existing_ticket = (
        db.query(DemoTicket)
        .filter(
            DemoTicket.event_id == event_id,
            DemoTicket.guest_id == guest.id,
            DemoTicket.ticket_status == "active",
        )
        .first()
    )
    if existing_ticket is not None:
        return {
            "status": "already_registered",
            "ticket": demo_ticket_to_dict(existing_ticket, db),
        }

    existing = (
        db.query(DemoWaitlist)
        .filter(
            DemoWaitlist.event_id == event_id,
            DemoWaitlist.guest_id == guest.id,
        )
        .first()
    )

    if existing is None:
        existing = DemoWaitlist(
            event_id=event_id,
            guest_id=guest.id,
            status="waiting",
        )
        db.add(existing)
    else:
        existing.status = "waiting"
        existing.promoted_at = None

    db.commit()
    db.refresh(existing)

    position = (
        db.query(func.count(DemoWaitlist.id))
        .filter(
            DemoWaitlist.event_id == event_id,
            DemoWaitlist.status == "waiting",
            DemoWaitlist.id <= existing.id,
        )
        .scalar()
        or 1
    )

    return {
        "status": "waiting",
        "position": int(position),
    }


@app.get("/demo/guests/{guest_token}/tickets")
def get_demo_tickets(
    guest_token: str,
    db: Session = Depends(get_db),
):
    guest = get_demo_guest_by_token(db, guest_token)

    if guest is None:
        raise HTTPException(
            status_code=404,
            detail="demo_guest_not_found",
        )

    tickets = (
        db.query(DemoTicket)
        .filter(DemoTicket.guest_id == guest.id)
        .order_by(DemoTicket.created_at.desc(), DemoTicket.id.desc())
        .all()
    )

    return [
        demo_ticket_to_dict(ticket, db)
        for ticket in tickets
    ]


@app.get("/demo/guests/{guest_token}/tickets/{ticket_id}")
def get_demo_ticket(
    guest_token: str,
    ticket_id: int,
    db: Session = Depends(get_db),
):
    guest = get_demo_guest_by_token(db, guest_token)

    if guest is None:
        raise HTTPException(status_code=404, detail="demo_guest_not_found")

    ticket = (
        db.query(DemoTicket)
        .filter(
            DemoTicket.id == ticket_id,
            DemoTicket.guest_id == guest.id,
        )
        .first()
    )

    if ticket is None:
        raise HTTPException(status_code=404, detail="ticket_not_found")

    return demo_ticket_to_dict(ticket, db)


@app.delete("/demo/guests/{guest_token}/tickets/{ticket_id}")
def cancel_demo_ticket(
    guest_token: str,
    ticket_id: int,
    db: Session = Depends(get_db),
):
    guest = get_demo_guest_by_token(db, guest_token)

    if guest is None:
        raise HTTPException(status_code=404, detail="demo_guest_not_found")

    ticket = (
        db.query(DemoTicket)
        .filter(
            DemoTicket.id == ticket_id,
            DemoTicket.guest_id == guest.id,
        )
        .first()
    )

    if ticket is None:
        raise HTTPException(status_code=404, detail="ticket_not_found")

    if ticket.ticket_status == "cancelled":
        return {
            "status": "already_cancelled",
            "ticket": demo_ticket_to_dict(ticket, db),
        }

    ticket.ticket_status = "cancelled"
    ticket.payment_status = "refunded_demo"
    ticket.cancelled_at = utc_now()

    db.flush()
    promoted = promote_demo_waitlist(db, ticket.event_id)
    if promoted is not None:
        db.flush()
        promoted_guest = db.query(DemoGuest).filter(DemoGuest.id == promoted.guest_id).first()
        queue_email(
            db, kind="ticket",
            event_key=f"ticket:{promoted.id}:issue:{hashlib.sha256(promoted.qr_token.encode()).hexdigest()[:20]}",
            recipient=promoted_guest.email if promoted_guest else None,
            guest_id=promoted.guest_id, ticket_id=promoted.id,
        )
    db.commit()
    db.refresh(ticket)

    return {
        "status": "cancelled",
        "ticket": demo_ticket_to_dict(ticket, db),
        "promoted_ticket_id": (
            promoted.id if promoted is not None else None
        ),
    }


@app.get("/demo/admin/events/{event_id}/tickets")
def demo_admin_event_tickets(
    event_id: int,
    _admin_key: str = Depends(require_demo_admin),
    db: Session = Depends(get_db),
):
    event = (
        db.query(Event)
        .filter(Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(status_code=404, detail="event_not_found")

    tickets = (
        db.query(DemoTicket)
        .filter(DemoTicket.event_id == event_id)
        .order_by(DemoTicket.id.asc())
        .all()
    )

    waitlist = (
        db.query(DemoWaitlist)
        .filter(DemoWaitlist.event_id == event_id)
        .order_by(DemoWaitlist.created_at.asc(), DemoWaitlist.id.asc())
        .all()
    )

    return {
        "event": event_to_dict(
            event,
            db=db,
            registered_count=get_registered_count(db, event.id),
        ),
        "tickets": [
            demo_ticket_to_dict(ticket, db)
            for ticket in tickets
        ],
        "waitlist": [
            {
                "id": entry.id,
                "guest_id": entry.guest_id,
                "status": entry.status,
                "created_at": entry.created_at,
                "promoted_at": entry.promoted_at,
                "guest": demo_guest_to_dict(
                    db.query(DemoGuest)
                    .filter(DemoGuest.id == entry.guest_id)
                    .first(),
                    db=db,
                ),
            }
            for entry in waitlist
            if db.query(DemoGuest)
            .filter(DemoGuest.id == entry.guest_id)
            .first() is not None
        ],
    }


@app.post("/demo/admin/check-in/{qr_token}")
def demo_admin_check_in(
    qr_token: str,
    _admin_key: str = Depends(require_demo_admin),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(DemoTicket)
        .filter(DemoTicket.qr_token == qr_token)
        .first()
    )

    if ticket is None:
        raise HTTPException(status_code=404, detail="ticket_not_found")

    if ticket.ticket_status != "active":
        raise HTTPException(status_code=409, detail="ticket_not_active")

    if ticket.checked_in_at is None:
        ticket.checked_in_at = utc_now()
        guest = db.query(DemoGuest).filter(DemoGuest.id == ticket.guest_id).first()
        queue_email(
            db, kind="checkin",
            event_key=f"checkin:{ticket.id}:{ticket.checked_in_at.isoformat()}",
            recipient=guest.email if guest else None,
            guest_id=ticket.guest_id,
            ticket_id=ticket.id,
            language=ticket_language(db, ticket.id),
        )
        db.commit()
        db.refresh(ticket)

    return {
        "status": "checked_in",
        "ticket": demo_ticket_to_dict(ticket, db),
    }


# Registers isolated website account and CSV endpoints after helper definitions.
install_demo_accounts(
    app, DemoGuest, DemoTicket, DemoWaitlist, Event, User,
    Registration, RegistrationPayment, get_db, require_demo_admin,
)

# Background delivery only on the isolated Demo API with configured Resend credentials.
install_email_worker(app, SessionLocal)

@app.get("/demo/admin/email/status")
def demo_email_status(
    _admin_key: str = Depends(require_demo_admin),
    db: Session = Depends(get_db),
):
    """Inspect readiness and queue counts without exposing mail secrets."""
    counts = dict(
        db.query(EmailOutbox.state, func.count(EmailOutbox.id))
        .group_by(EmailOutbox.state).all()
    )
    return {
        "provider": "resend",
        "enabled": email_enabled(),
        "configured": email_configured(),
        "counts": counts,
    }

# All owner/role authorization on server; no shared admin key for organizers.
install_demo_roles(app, get_db, __import__("sys").modules[__name__])

install_account_moderation(app, get_db)
install_email_account_security(app, get_db)

# Privacy defaults for all user-specific responses, including errors.
@app.middleware("http")
async def crowdly_security_response_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), payment=()"
    # No intermediary, browser or PWA cache may store personal profile, ticket,
    # registration or organizer data. Public poster images keep their cache policy.
    path = request.url.path
    if path.startswith("/demo/") and "/poster" not in path:
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["Pragma"] = "no-cache"
    return response

# Telegram Mini App authorization: initData is validated with the BOT token on the server.
install_telegram_auth(app, get_db, __import__('sys').modules[__name__])
