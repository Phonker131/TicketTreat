# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# SQLAlchemy table mappings/relations; schema changes must match reviewed, forward-only SQL migrations and data-integrity tests.
# Do not change this file casually. Open a PR and request @Phonker131 review;
# run security/DB integration tests and document migration or rollback impact.
# See docs/CRITICAL_CODE_AREAS.md (comments alone do not enforce access).
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    contact_preference = Column(String, nullable=True)
    instagram = Column(String, nullable=True)

    registrations = relationship("Registration", back_populates="user")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    organizer = Column(String, nullable=True)
    description = Column(String, nullable=True)
    location = Column(String, nullable=True)
    max_participants = Column(Integer, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)

    currency = Column(
        String(3),
        nullable=False,
        default="CZK",
        server_default="CZK",
    )

    image_url = Column(String, nullable=True)
    starts_at = Column(DateTime, default=datetime.utcnow)
    telegram_photo_file_id = Column(String, nullable=True)
    reminder_minutes_before = Column(Integer, nullable=True)
    reminder_text = Column(String, nullable=True)
    reminder_sent = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    registrations = relationship("Registration", back_populates="event")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))
    event_id = Column(Integer, ForeignKey("events.id"))

    user = relationship("User", back_populates="registrations")
    event = relationship("Event", back_populates="registrations")