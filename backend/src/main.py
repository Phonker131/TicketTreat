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
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        return {
            "id": event.id,
            "title": event.title,
            "organizer": event.organizer,
            "description": event.description,
            "location": event.location,
            "max_participants": event.max_participants,
            "price": str(event.price) if event.price is not None else None,
            "image_url": event.image_url,
            "starts_at": event.starts_at,
            "telegram_photo_file_id": event.telegram_photo_file_id,
        }
    finally:
        db.close()

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
            # обновляем username и first_name, если они пришли
            if payload.username is not None:
                user.username = payload.username

            if payload.first_name is not None and not user.first_name:
                user.first_name = payload.first_name

            db.commit()
            db.refresh(user)

        existing = (
            db.query(Registration)
            .filter(Registration.user_id == user.id, Registration.event_id == event_id)
            .first()
        )

        if existing:
            return {
                "status": "already_registered",
                "user_id": user.id,
                "event_id": event_id,
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
        }
    finally:
        db.close()

@app.get("/events")
def list_events():
    db = SessionLocal()
    try:
        events = (
            db.query(Event)
            .filter(Event.starts_at > datetime.utcnow())
            .order_by(Event.starts_at.asc())
            .all()
        )
        return [
            {
                "id": e.id,
                "title": e.title,
                "organizer": e.organizer,
                "description": e.description,
                "location": e.location,
                "max_participants": e.max_participants,
                "price": str(e.price) if e.price is not None else None,
                "image_url": e.image_url,
                "starts_at": e.starts_at,
                "telegram_photo_file_id": e.telegram_photo_file_id,
            }
            for e in events
        ]
    finally:
        db.close()

@app.get("/events/{event_id}")
def get_event(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()

        if not event:
            return {"error": "event_not_found"}

        return {
            "id": event.id,
            "title": event.title,
            "organizer": event.organizer,
            "description": event.description,
            "location": event.location,
            "max_participants": event.max_participants,
            "price": str(event.price) if event.price is not None else None,
            "image_url": event.image_url,
            "starts_at": event.starts_at,
            "telegram_photo_file_id": event.telegram_photo_file_id,
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