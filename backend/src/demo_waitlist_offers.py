"""Optional, transactionally reserved waitlist offers for free events.

Default legacy behaviour is auto-promotion. Organizers may opt into a timed
claim policy. Every allocation/expiration/acceptance happens under a locked
Event row, so parallel web replicas cannot overbook.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from db.base import Base


class WaitlistOffer(Base):
    __tablename__ = "demo_waitlist_offers"
    id = Column(Integer, primary_key=True)
    waitlist_id = Column(Integer, nullable=False, unique=True)
    event_id = Column(Integer, nullable=False, index=True)
    guest_id = Column(Integer, nullable=False, index=True)
    status = Column(String(24), nullable=False, default="offered")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    offered_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)


def utc(dt):
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def offer_count(db, event_id, guest_id=None, now=None):
    now = now or datetime.now(timezone.utc)
    q = db.query(func.count(WaitlistOffer.id)).filter(
        WaitlistOffer.event_id == event_id, WaitlistOffer.status == "offered",
        WaitlistOffer.expires_at > now)
    if guest_id is not None:
        q = q.filter(WaitlistOffer.guest_id != guest_id)
    return int(q.scalar() or 0)


def expire_for_event(db, event_id, now=None):
    from main import DemoWaitlist
    now = now or datetime.now(timezone.utc)
    expired = db.query(WaitlistOffer).filter(
        WaitlistOffer.event_id == event_id,
        WaitlistOffer.status == "offered", WaitlistOffer.expires_at <= now
    ).all()
    for offer in expired:
        offer.status = "expired"
        entry = db.get(DemoWaitlist, offer.waitlist_id)
        if entry is not None and entry.status == "offered":
            entry.status = "expired"
    db.flush()
    return len(expired)


def maybe_offer_next(db, event, registered_count):
    """Allocate one offered seat; caller must already lock Event row."""
    from main import DemoWaitlist, DemoGuest
    from demo_pilot_ops import effective_settings
    from demo_email import queue_email
    minutes = effective_settings(db, event.id).get("waitlist_offer_minutes", 0)
    if not minutes:
        return None
    if event.starts_at is None:
        return None
    from main import normalize_event_datetime, event_has_started, price_decimal
    from demo_pilot_ops import booking_cutoff_reached
    if event.is_cancelled or event_has_started(event) or booking_cutoff_reached(db, event) or price_decimal(event.price) != 0:
        return None
    now = datetime.now(timezone.utc)
    remaining = utc(normalize_event_datetime(event.starts_at)) - now
    if remaining <= timedelta(minutes=15):
        return None
    expire_for_event(db, event.id, now)
    if event.max_participants is None or registered_count + offer_count(db, event.id, now=now) >= event.max_participants:
        return None
    entry = db.query(DemoWaitlist).filter(
        DemoWaitlist.event_id == event.id, DemoWaitlist.status == "waiting"
    ).order_by(DemoWaitlist.created_at, DemoWaitlist.id).first()
    if entry is None:
        return None
    expires = min(now + timedelta(minutes=minutes), utc(normalize_event_datetime(event.starts_at)) - timedelta(minutes=10))
    existing = db.query(WaitlistOffer).filter(WaitlistOffer.waitlist_id == entry.id).first()
    if existing:
        existing.status,existing.expires_at,existing.offered_at,existing.accepted_at = "offered",expires,now,None
        offer=existing
    else:
        offer=WaitlistOffer(waitlist_id=entry.id,event_id=event.id,guest_id=entry.guest_id,
                             status="offered",expires_at=expires,offered_at=now)
        db.add(offer)
    entry.status="offered"
    entry.promoted_at=now
    db.flush()
    guest = db.get(DemoGuest,entry.guest_id)
    if guest is not None:
        queue_email(db,kind="waitlist_offer",
            event_key=f"waitlist-offer:{entry.id}:{int(now.timestamp())}",
            recipient=guest.email,guest_id=guest.id,language="en")
    return offer


def ensure_available_offer(db,event,guest):
    now = datetime.now(timezone.utc)
    expire_for_event(db,event.id,now)
    offer = db.query(WaitlistOffer).filter(
        WaitlistOffer.event_id == event.id,WaitlistOffer.guest_id == guest.id,
        WaitlistOffer.status == "offered",WaitlistOffer.expires_at > now).first()
    return offer


def accept_offer(db,event,guest):
    from main import DemoWaitlist
    from fastapi import HTTPException
    offer = ensure_available_offer(db,event,guest)
    if offer is None:
        raise HTTPException(409,"waitlist_offer_unavailable_or_expired")
    offer.status="accepted"
    offer.accepted_at=datetime.now(timezone.utc)
    entry=db.get(DemoWaitlist,offer.waitlist_id)
    if entry is not None:
        entry.status="promoted"
    db.flush()
    return offer
