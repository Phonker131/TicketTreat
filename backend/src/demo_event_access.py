"""Server-side access rules for unlisted invitation-only events.

An opaque 256-bit link token grants *event discovery and booking* access, not
account identity or organizer permissions. Treat the invitation as a bearer
credential: never put it in logs, sitemap XML, analytics or public API listings.
"""
from __future__ import annotations

import re
import secrets

from fastapi import HTTPException
from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String
from db.base import Base

TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


class EventAccess(Base):
    __tablename__ = "demo_event_invites"
    __table_args__ = (CheckConstraint("length(invite_token) = 43", name="ck_demo_event_invites_token_len"),)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    invite_token = Column(String(64), nullable=False, unique=True)


def invite_for(db, event_id: int) -> EventAccess | None:
    return db.get(EventAccess, event_id)


def is_unlisted(db, event_id: int) -> bool:
    return invite_for(db, event_id) is not None


def require_invite(db, event_id: int, presented: str | None) -> None:
    """Return a uniform 404 so guests cannot enumerate private event IDs."""
    row = invite_for(db, event_id)
    if row is None:
        return
    if (not isinstance(presented, str) or not TOKEN_PATTERN.fullmatch(presented)
            or not secrets.compare_digest(row.invite_token, presented)):
        raise HTTPException(status_code=404, detail="event_not_found")



def require_media_access(db, event_id: int, presented: str | None,
                         authorization: str | None) -> None:
    """Private media: accept valid invitation OR authenticated event owner.

    An owner may preview a private event's poster/gallery without possessing
    the invitation token; an unrelated logged-in account cannot bypass it.
    """
    try:
        require_invite(db, event_id, presented)
        return
    except HTTPException:
        if not authorization:
            raise
    try:
        from demo_roles import account_lookup, ensure_owner
        ensure_owner(db, event_id, account_lookup(db, authorization))
    except HTTPException:
        raise HTTPException(status_code=404, detail="event_not_found") from None


def set_visibility(db, event_id: int, visibility: str) -> None:
    if visibility not in {"public", "link_only"}:
        raise HTTPException(status_code=422, detail="invalid_event_visibility")
    row = invite_for(db, event_id)
    if visibility == "link_only" and row is None:
        db.add(EventAccess(event_id=event_id, invite_token=secrets.token_urlsafe(32)))
        db.flush()
    elif visibility == "public" and row is not None:
        db.delete(row)
        db.flush()


def organizer_invite_url(db, event_id: int) -> str | None:
    row = invite_for(db, event_id)
    if row is None:
        return None
    return f"https://tickettreat.eu/events/{event_id}?invite={row.invite_token}"


def public_only(db, events: list) -> list:
    if not events:
        return []
    ids = [event.id for event in events]
    restricted = {
        row[0] for row in db.query(EventAccess.event_id).filter(EventAccess.event_id.in_(ids)).all()
    }
    return [event for event in events if event.id not in restricted]
