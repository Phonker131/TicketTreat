"""Safe publication lifecycle for organizer-managed events.

Legacy events without a row remain visible to preserve existing bot bookings.
Every new managed event is explicitly drafted. Scheduled publication is computed
at read/booking time (no single-process cron assumption across Railway replicas).
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from db.base import Base


class EventPublication(Base):
    __tablename__ = "demo_event_publications"
    event_id = Column(Integer, ForeignKey("events.id"), primary_key=True)
    status = Column(String(16), nullable=False, default="draft")
    publish_at = Column(DateTime(timezone=True), nullable=True)


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def state(db, event_id: int, now: datetime | None = None) -> dict:
    row = db.get(EventPublication, event_id)
    if row is None:
        return {"status": "published", "publish_at": None, "visible": True}
    visible = row.status == "published" or (
        row.status == "scheduled" and row.publish_at is not None
        and utc(row.publish_at) <= (now or datetime.now(timezone.utc))
    )
    return {"status": "published" if visible else row.status,
            "publish_at": row.publish_at, "visible": visible}


def require_published(db, event_id: int) -> None:
    if not state(db, event_id)["visible"]:
        raise HTTPException(status_code=404, detail="event_not_found")


def set_publication(db, event_id: int, status: str,
                    publish_at: datetime | None = None) -> dict:
    if status not in {"draft", "published", "scheduled"}:
        raise HTTPException(422, "invalid_publication_status")
    row = db.get(EventPublication, event_id)
    if row is None:
        row = EventPublication(event_id=event_id)
        db.add(row)
    row.status = status
    row.publish_at = utc(publish_at) if status == "scheduled" and publish_at else None
    db.flush()
    return state(db, event_id)
