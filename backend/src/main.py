from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field
from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Session

from db import models
from db.base import Base
from db.session import SessionLocal, engine, get_db


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


# Creates only tables that do not already exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Crowdly API")

PRAGUE_TZ = ZoneInfo("Europe/Prague")
PAYMENT_CONFIRMATION_HOURS = 24


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
    return (
        db.query(func.count(Registration.id))
        .filter(Registration.event_id == event_id)
        .scalar()
        or 0
    )


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


# Protected website / Telegram Mini App API (separate from legacy bot routes)
from web_api import install as install_web_api
install_web_api(app)
