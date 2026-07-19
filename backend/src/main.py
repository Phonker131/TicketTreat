import os
from fastapi import FastAPI
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from db.base import Base
from db.session import engine
from db import models
from db.session import SessionLocal
from db.models import Event
from pydantic import BaseModel
from datetime import datetime
from db.models import User, Registration
from decimal import Decimal

# Загружаем переменные из .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI()

# Создаём подключение к базе
engine = create_engine(DATABASE_URL)

class ProfileUpdate(BaseModel):
    telegram_id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    contact_preference: str | None = None
    instagram: str | None = None

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            return {"database": "connected"}
    except Exception as e:
        return {"database": "error", "details": str(e)}



Base.metadata.create_all(bind=engine)

class EventCreate(BaseModel):
    title: str
    organizer: str | None = None
    description: str | None = None
    location: str | None = None
    max_participants: int | None = None
    price: Decimal | None = None
    image_url: str | None = None
    starts_at: datetime | None = None
    telegram_photo_file_id: str | None = None
    reminder_minutes_before: int | None = None
    reminder_text: str | None = None


@app.post("/events")
def create_event(payload: EventCreate):
    db = SessionLocal()
    try:
        event = Event(
            title=payload.title,
            organizer=payload.organizer,
            description=payload.description,
            location=payload.location,
            max_participants=payload.max_participants,
            price=payload.price,
            image_url=payload.image_url,
            starts_at=payload.starts_at or datetime.utcnow(),
            telegram_photo_file_id=payload.telegram_photo_file_id,
            reminder_minutes_before=payload.reminder_minutes_before,
            reminder_text=payload.reminder_text,
            reminder_sent=False,
            is_cancelled=False,
        )

        db.add(event)
        db.commit()
        db.refresh(event)

        return event_to_dict(event)
    finally:
        db.close()

class EventUpdate(BaseModel):
    title: str | None = None
    organizer: str | None = None
    location: str | None = None
    description: str | None = None
    max_participants: int | None = None
    price: Decimal | None = None
    image_url: str | None = None
    starts_at: datetime | None = None
    telegram_photo_file_id: str | None = None
    reminder_minutes_before: int | None = None
    reminder_text: str | None = None


class EventCancel(BaseModel):
    reason: str | None = None

def event_to_dict(event: Event, registered_count: int | None = None):
    data = {
        "id": event.id,
        "title": event.title,
        "organizer": event.organizer,
        "location": event.location,
        "description": event.description,
        "max_participants": event.max_participants,
        "price": str(event.price) if event.price is not None else None,
        "image_url": event.image_url,
        "starts_at": event.starts_at,
        "telegram_photo_file_id": event.telegram_photo_file_id,
        "reminder_minutes_before": event.reminder_minutes_before,
        "reminder_text": event.reminder_text,
        "reminder_sent": event.reminder_sent,
        "is_cancelled": event.is_cancelled,
        "cancellation_reason": event.cancellation_reason,
        "cancelled_at": event.cancelled_at,
    }

    if registered_count is not None:
        data["registered_count"] = registered_count

        if event.max_participants is not None:
            data["spots_left"] = max(event.max_participants - registered_count, 0)
        else:
            data["spots_left"] = None

    return data

class RegisterPayload(BaseModel):
    telegram_id: int
    username: str | None = None
    first_name: str | None = None


@app.post("/events/{event_id}/register")
def register_to_event(event_id: int, payload: RegisterPayload):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            return {"error": "event_not_found"}

        if event.is_cancelled:
            return {"error": "event_cancelled"}

        if event.starts_at and event.starts_at <= datetime.utcnow():
            return {"error": "event_already_started"}

        user = db.query(User).filter(User.telegram_id == payload.telegram_id).first()

        if not user:
            user = User(
                telegram_id=payload.telegram_id,
                username=payload.username,
                first_name=payload.first_name,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if payload.username is not None:
                user.username = payload.username

            if payload.first_name is not None and not user.first_name:
                user.first_name = payload.first_name

            db.commit()
            db.refresh(user)

        existing = (
            db.query(Registration)
            .filter(
                Registration.user_id == user.id,
                Registration.event_id == event_id,
            )
            .first()
        )

        if existing:
            return {
                "status": "already_registered",
                "user_id": user.id,
                "event_id": event_id,
            }

        registered_count = get_registered_count(db, event_id)

        if event.max_participants is not None and registered_count >= event.max_participants:
            return {
                "error": "event_full",
                "registered_count": registered_count,
                "max_participants": event.max_participants,
            }

        reg = Registration(user_id=user.id, event_id=event_id)
        db.add(reg)
        db.commit()
        db.refresh(reg)

        return {
            "status": "registered",
            "registration_id": reg.id,
            "user_id": user.id,
            "event_id": event_id,
            "registered_count": registered_count + 1,
            "max_participants": event.max_participants,
        }
    finally:
        db.close()

def get_registered_count(db, event_id: int) -> int:
    return (
        db.query(Registration)
        .filter(Registration.event_id == event_id)
        .count()
    )

@app.delete("/events/{event_id}/register/{telegram_id}")
def unregister_from_event(event_id: int, telegram_id: int):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()

        if not user:
            return {"status": "not_registered"}

        reg = (
            db.query(Registration)
            .filter(
                Registration.user_id == user.id,
                Registration.event_id == event_id,
            )
            .first()
        )

        if not reg:
            return {"status": "not_registered"}

        db.delete(reg)
        db.commit()

        return {
            "status": "unregistered",
            "event_id": event_id,
            "telegram_id": telegram_id,
        }
    finally:
        db.close()

@app.get("/users/{telegram_id}/events")
def get_user_events(telegram_id: int):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()

        if not user:
            return []

        regs = (
            db.query(Registration)
            .join(Event)
            .filter(Registration.user_id == user.id)
            .filter(Event.starts_at > datetime.utcnow())
            .filter(Event.is_cancelled == False)
            .order_by(Event.starts_at.asc())
            .all()
        )

        return [event_to_dict(reg.event) for reg in regs]
    finally:
        db.close()

@app.get("/users")
def list_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()

        return [
            {
                "telegram_id": u.telegram_id,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "phone": u.phone,
                "contact_preference": u.contact_preference,
                "instagram": u.instagram,
            }
            for u in users
            if u.telegram_id is not None
        ]
    finally:
        db.close()

@app.get("/events")
def list_events():
    db = SessionLocal()
    try:
        events = (
            db.query(Event)
            .filter(Event.starts_at > datetime.utcnow())
            .filter(Event.is_cancelled == False)
            .order_by(Event.starts_at.asc())
            .all()
        )

        result = []

        for event in events:
            registered_count = get_registered_count(db, event.id)
            result.append(event_to_dict(event, registered_count))

        return result
    finally:
        db.close()

@app.get("/events/{event_id}")
def get_event(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            return {"error": "event_not_found"}

        registered_count = get_registered_count(db, event.id)

        return event_to_dict(event, registered_count)
    finally:
        db.close()

@app.patch("/events/{event_id}")
def update_event(event_id: int, payload: EventUpdate):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            return {"error": "event_not_found"}

        try:
            data = payload.model_dump(exclude_unset=True)
        except AttributeError:
            data = payload.dict(exclude_unset=True)

        reminder_related_fields = {
            "starts_at",
            "reminder_minutes_before",
            "reminder_text",
        }

        for field, value in data.items():
            if hasattr(event, field):
                setattr(event, field, value)

        if any(field in data for field in reminder_related_fields):
            event.reminder_sent = False

        db.commit()
        db.refresh(event)

        return {
            "status": "updated",
            "event": event_to_dict(event),
        }
    finally:
        db.close()

@app.post("/events/{event_id}/cancel")
def cancel_event(event_id: int, payload: EventCancel):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            return {"error": "event_not_found"}

        event.is_cancelled = True
        event.cancellation_reason = payload.reason
        event.cancelled_at = datetime.utcnow()

        db.commit()
        db.refresh(event)

        return {
            "status": "cancelled",
            "event": event_to_dict(event),
        }
    finally:
        db.close()

@app.get("/events/{event_id}/participants")
def get_participants(event_id: int):
    db = SessionLocal()
    try:
        regs = (
            db.query(Registration)
            .filter(Registration.event_id == event_id)
            .all()
        )

        results = []
        for r in regs:
            results.append({
                "telegram_id": r.user.telegram_id,
                "username": r.user.username,
                "first_name": r.user.first_name,
                "last_name": r.user.last_name,
                "phone": r.user.phone,
                "contact_preference": r.user.contact_preference,
                "instagram": r.user.instagram,
            })

        return results
    finally:
        db.close()


@app.post("/profile")
def update_profile(payload: ProfileUpdate):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == payload.telegram_id).first()

        if not user:
            user = User(telegram_id=payload.telegram_id)
            db.add(user)

        if payload.username is not None:
            user.username = payload.username

        if payload.first_name is not None:
            user.first_name = payload.first_name

        if payload.last_name is not None:
            user.last_name = payload.last_name

        if payload.phone is not None:
            user.phone = payload.phone

        if payload.contact_preference is not None:
            user.contact_preference = payload.contact_preference

        if payload.instagram is not None:
            user.instagram = payload.instagram

        db.commit()
        db.refresh(user)

        return {
            "status": "ok",
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "contact_preference": user.contact_preference,
            "instagram": user.instagram,
        }
    finally:
        db.close()

@app.get("/profile/{telegram_id}")
def get_profile(telegram_id: int):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        if not user:
            return {"exists": False, "complete": False}

        complete = bool(user.first_name and user.last_name and user.phone)
        return {
            "exists": True,
            "complete": complete,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "username": user.username,
            "contact_preference": user.contact_preference,
            "instagram": user.instagram,
        }
    finally:
        db.close()

@app.post("/events/{event_id}/reminder-sent")
def mark_reminder_sent(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            return {"error": "event_not_found"}

        event.reminder_sent = True
        db.commit()

        return {"status": "ok", "event_id": event_id}
    finally:
        db.close()
