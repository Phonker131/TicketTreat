"""Organizer Rewards preview: completed QR-verified events over a rolling 3 months.

This is NOT a subscription or Stripe discount. It only reports a potential
future percentage; billing, invoices, and payment state remain untouched.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import CheckConstraint, Column, Integer, String, func, text
from sqlalchemy.orm import Session

from db.base import Base
from demo_loyalty_benefits import (canonical_loyalty_owner, loyalty_alias_lookup,
                                   loyalty_attendance_scope)
from demo_pilot_ops import effective_settings
from demo_publication import state as publication_state
from demo_roles import EventOwnership, account_lookup, audit, ensure_manage, role_for


PRAGUE = ZoneInfo("Europe/Prague")
DEFAULT_LEVELS = (
    ("starter", 0, 0),
    ("bronze", 3, 10),
    ("silver", 6, 20),
    ("gold", 11, 30),
    ("platinum", 20, 40),
)
LEVEL_IDS = tuple(level for level, _, _ in DEFAULT_LEVELS)


class OrganizerDiscountLevel(Base):
    __tablename__ = "organizer_subscription_reward_levels"
    __table_args__ = (
        CheckConstraint("min_events >= 0 AND min_events <= 10000", name="ck_organizer_discount_min_events"),
        CheckConstraint("discount_pct >= 0 AND discount_pct <= 80", name="ck_organizer_discount_pct"),
    )
    tier = Column(String(16), primary_key=True)
    min_events = Column(Integer, nullable=False)
    discount_pct = Column(Integer, nullable=False)


class DiscountLevelInput(BaseModel):
    tier: str
    min_events: int = Field(strict=True, ge=0, le=10000)
    discount_pct: int = Field(strict=True, ge=0, le=80)


class DiscountLevelsUpdate(BaseModel):
    levels: list[DiscountLevelInput] = Field(min_length=5, max_length=5)


def rolling_three_months(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Same local time three calendar months ago; clamp short month days."""
    end = (now or datetime.now(timezone.utc)).astimezone(PRAGUE)
    index = end.year * 12 + (end.month - 1) - 3
    year, zero_month = divmod(index, 12)
    month = zero_month + 1
    start = end.replace(year=year, month=month,
                        day=min(end.day, monthrange(year, month)[1]))
    return start, end


def configured_levels(db: Session) -> list[dict]:
    saved = {r.tier: r for r in db.query(OrganizerDiscountLevel).all()}
    return [dict(tier=tier,
                 min_events=saved[tier].min_events if tier in saved else threshold,
                 discount_pct=saved[tier].discount_pct if tier in saved else discount)
            for tier, threshold, discount in DEFAULT_LEVELS]


def discount_progress(count: int, levels: list[dict]) -> dict:
    current = max((i for i, level in enumerate(levels) if count >= level["min_events"]), default=0)
    following = levels[current + 1] if current + 1 < len(levels) else None
    return {"tier": levels[current]["tier"],
            "discount_pct": levels[current]["discount_pct"],
            "next_tier": following["tier"] if following else None,
            "next_threshold": following["min_events"] if following else None,
            "events_to_next": max(0, following["min_events"] - count) if following else 0}


def qualified_events(db: Session, main, owner_id: int, start: datetime, end: datetime) -> int:
    """Only ended, non-cancelled events with >=1 active QR check-in count.

    Use the existing explicitly reviewed legacy-organizer alias scope, not
    matching names alone. Never count drafts, bookings or cancelled events.
    """
    events = (db.query(main.Event)
              .join(EventOwnership, EventOwnership.event_id == main.Event.id)
              .filter(loyalty_attendance_scope(db, owner_id, main.Event),
                      main.Event.starts_at >= start.replace(tzinfo=None),
                      main.Event.starts_at <= end.replace(tzinfo=None),
                      main.Event.is_cancelled.is_not(True))
              .all())
    if not events:
        return 0
    eligible_ids = []
    for event in events:
        if not publication_state(db, event.id)["visible"]:
            continue
        starts = main.normalize_event_datetime(event.starts_at)
        duration = effective_settings(db, event.id)["event_duration_minutes"]
        if starts + timedelta(minutes=duration) <= end:
            eligible_ids.append(event.id)
    if not eligible_ids:
        return 0
    count = (db.query(func.count(func.distinct(main.DemoTicket.event_id)))
             .filter(main.DemoTicket.event_id.in_(eligible_ids),
                     main.DemoTicket.ticket_status == "active",
                     main.DemoTicket.checked_in_at.isnot(None))
             .scalar())
    return int(count or 0)


def install_organizer_subscription_rewards(app, get_db, main):
    def current(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        account = account_lookup(db, authorization)
        ensure_manage(db, account)
        return account

    @app.get("/demo/manage/organizer-subscription-rewards")
    def overview(account=Depends(current), db: Session = Depends(get_db)):
        role = role_for(db, account)
        aliases = loyalty_alias_lookup(db)
        entries = (db.query(EventOwnership.owner_account_id, main.Event.organizer)
                   .join(main.Event, main.Event.id == EventOwnership.event_id)
                   .order_by(EventOwnership.event_id.desc()).all())
        names = {}
        for source, name in entries:
            owner = canonical_loyalty_owner(int(source), name, aliases)
            if role != "global_admin" and owner != account.id:
                continue
            if owner not in names:
                names[owner] = str(name or "").strip()[:120] or f"Organizer #{owner}"
        # A newly approved organizer should see Starter progress even before
        # publishing their first event. Admins need not see empty accounts.
        if role == "organizer" and account.id not in names:
            names[account.id] = f"Organizer #{account.id}"
        start, end = rolling_three_months()
        levels = configured_levels(db)
        return {"period_months": 3,
                "period_start": start.isoformat(), "period_end": end.isoformat(),
                "billing_active": False, "discount_applied": False,
                "preview_only": True, "editable": role == "global_admin",
                "levels": levels,
                "organizers": [dict(owner_account_id=owner, name=name,
                                    qualified_events=(n := qualified_events(db, main, owner, start, end)),
                                    **discount_progress(n, levels))
                               for owner, name in sorted(names.items(), key=lambda pair: (pair[1].casefold(), pair[0]))]}

    @app.put("/demo/manage/organizer-subscription-rewards/levels")
    def update_levels(payload: DiscountLevelsUpdate, account=Depends(current),
                      db: Session = Depends(get_db)):
        if role_for(db, account) != "global_admin":
            raise HTTPException(403, "global_admin_only")
        items = payload.levels
        if [i.tier for i in items] != list(LEVEL_IDS):
            raise HTTPException(422, "organizer_discount_tier_order")
        if items[0].min_events != 0 or items[0].discount_pct != 0 or any(
                items[i].min_events >= items[i + 1].min_events or
                items[i].discount_pct > items[i + 1].discount_pct
                for i in range(len(items) - 1)):
            raise HTTPException(422, "organizer_discount_levels_must_increase")
        # The lock key is shared by all admins: concurrent initial writes must
        # not race each other into a duplicate primary key.
        db.execute(text("SELECT pg_advisory_xact_lock(771947318)"))
        for item in items:
            row = db.get(OrganizerDiscountLevel, item.tier)
            if row is None:
                row = OrganizerDiscountLevel(tier=item.tier)
                db.add(row)
            row.min_events = item.min_events
            row.discount_pct = item.discount_pct
        # Keep a revision in the same audit trail used for organizer settings.
        first_event = db.query(EventOwnership.event_id).order_by(EventOwnership.event_id).first()
        if first_event:
            audit(db, int(first_event[0]), account.id, "edit_organizer_subscription_rewards",
                  ";".join(f"{i.tier}:{i.min_events}/{i.discount_pct}" for i in items))
        db.commit()
        return {"levels": configured_levels(db), "preview_only": True}
