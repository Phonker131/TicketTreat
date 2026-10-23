"""V1 loyalty passport: verified, studio-scoped check-ins and fair queue priority.

An organizer is the V1 studio identity (demo_event_ownership.owner_account_id).
V2 cross-studio loyalty must be a separate explicit policy, not an accidental sum
of unrelated organizers. All rewards derive from existing server-side check-ins:
no mutable client points, reward balance, paid discount or redemption promises.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

PRAGUE = ZoneInfo("Europe/Prague")
TIERS = (("newcomer", 0), ("regular", 3), ("insider", 6), ("vip", 12))
NEXT = (3, 6, 12)


def season_bounds(now: datetime | None = None) -> tuple[str, datetime, datetime]:
    """Fixed Czech calendar quarter; comparison bounds are UTC instants."""
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    local = instant.astimezone(PRAGUE)
    first_month = ((local.month - 1) // 3) * 3 + 1
    start = datetime(local.year, first_month, 1, tzinfo=PRAGUE)
    end = (datetime(local.year + 1, 1, 1, tzinfo=PRAGUE)
           if first_month == 10 else datetime(local.year, first_month + 3, 1, tzinfo=PRAGUE))
    return f"{local.year}-Q{(first_month - 1) // 3 + 1}", start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def tier_for(visits: int) -> dict:
    name, threshold = max((t for t in TIERS if visits >= t[1]), key=lambda t: t[1])
    next_at = next((v for v in NEXT if visits < v), None)
    return {
        "tier": name, "threshold": threshold, "next_threshold": next_at,
        "remaining": max(0, next_at - visits) if next_at is not None else 0,
        "progress_percent": 100 if next_at is None else min(100, round(100 * (visits - threshold) / (next_at - threshold))),
    }


def attendance_counts(db: Session, owner_id: int, guest_ids: list[int], *,
                      now: datetime | None = None, main=None) -> dict[int, int]:
    """Count unique *visited events* in the current season, never bookings.

    This is also the only source for waitlist tier decisions, so an attendee
    cannot award their own points and replayed scans cannot inflate priority.
    """
    if not guest_ids:
        return {}
    if main is None:
        import main as main
    from demo_roles import EventOwnership
    _season, start, end = season_bounds(now)
    rows = (db.query(main.DemoTicket.guest_id, func.count(func.distinct(main.DemoTicket.event_id)))
            .join(EventOwnership, EventOwnership.event_id == main.DemoTicket.event_id)
            .join(main.Event, main.Event.id == main.DemoTicket.event_id)
            .filter(EventOwnership.owner_account_id == owner_id,
                    main.DemoTicket.guest_id.in_(guest_ids),
                    main.DemoTicket.ticket_status == "active",
                    main.DemoTicket.checked_in_at.isnot(None),
                    main.DemoTicket.checked_in_at >= start,
                    main.DemoTicket.checked_in_at < end,
                    main.Event.is_cancelled.is_not(True))
            .group_by(main.DemoTicket.guest_id).all())
    return {int(gid): int(count) for gid, count in rows}


def passport_for(db: Session, guest_id: int, main, *, now: datetime | None = None) -> dict:
    """The user's own studio passports, including studios with bookings but no visits."""
    from demo_roles import EventOwnership
    season, start, end = season_bounds(now)
    records = (db.query(EventOwnership.owner_account_id, main.Event.organizer,
                        main.DemoTicket.event_id, main.DemoTicket.checked_in_at,
                        main.DemoTicket.ticket_status, main.Event.is_cancelled)
               .join(main.DemoTicket, main.DemoTicket.event_id == EventOwnership.event_id)
               .join(main.Event, main.Event.id == main.DemoTicket.event_id)
               .filter(main.DemoTicket.guest_id == guest_id)
               .order_by(main.DemoTicket.event_id).all())
    studios: dict[int, dict] = {}
    for owner, label, event_id, checked_at, status, cancelled in records:
        studio = studios.setdefault(int(owner), {
            "organizer_id": int(owner), "organizer_name": str(label or "").strip()[:120] or "TicketTreat organizer",
            "visits": set(), "total_visits": set(),
        })
        if label and studio["organizer_name"] == "TicketTreat organizer":
            studio["organizer_name"] = str(label).strip()[:120]
        if status != "active" or cancelled or checked_at is None:
            continue
        studio["total_visits"].add(int(event_id))
        at = checked_at.replace(tzinfo=timezone.utc) if checked_at.tzinfo is None else checked_at.astimezone(timezone.utc)
        if start <= at < end:
            studio["visits"].add(int(event_id))
    result = []
    for studio in studios.values():
        count = len(studio.pop("visits"))
        lifetime = len(studio.pop("total_visits"))
        result.append({
            **studio, "season_visits": count, "lifetime_visits": lifetime,
            **tier_for(count),
            # Only queue priority is live in V1 pilot. Other roadmap perks
            # require organizer inventory, publication windows or funding.
            "perks": [
                {"key": "priority_waitlist", "required_visits": 3, "available": count >= 3, "operational": True},
                {"key": "early_access", "required_visits": 6, "available": False, "operational": False},
                {"key": "vip_companion", "required_visits": 12, "available": False, "operational": False},
            ],
        })
    result.sort(key=lambda s: (-s["season_visits"], s["organizer_name"].casefold(), s["organizer_id"]))
    return {"season": season, "season_starts_at": start.isoformat(), "season_ends_at": end.isoformat(),
            "scope": "per_organizer", "studios": result, "total_lifetime_visits": sum(x["lifetime_visits"] for x in result)}


def priority_waitlist_entry(db: Session, event, main):
    """Pick highest entitled tier; preserve FIFO within tier, avoid overselling.

    Caller retains the existing Event row lock/capacity checks before offering
    or promoting. No ownership means FIFO (the previous behavior).
    """
    from demo_roles import EventOwnership
    waiting = (db.query(main.DemoWaitlist)
               .filter(main.DemoWaitlist.event_id == event.id,
                       main.DemoWaitlist.status == "waiting")
               .order_by(main.DemoWaitlist.created_at.asc(), main.DemoWaitlist.id.asc())
               .all())
    if len(waiting) <= 1:
        return waiting[0] if waiting else None
    owner = db.get(EventOwnership, event.id)
    if owner is None:
        return waiting[0]
    counts = attendance_counts(db, owner.owner_account_id,
                               [int(entry.guest_id) for entry in waiting], main=main)
    # Python stable sort preserves already-ordered FIFO entries in a level.
    waiting.sort(key=lambda entry: -tier_for(counts.get(int(entry.guest_id), 0))["threshold"])
    return waiting[0]


def install_loyalty_api(app, get_db, main, guest_for) -> None:
    @app.get("/demo/me/loyalty")
    def my_loyalty(guest=Depends(guest_for), db: Session = Depends(get_db)):
        return passport_for(db, guest.id, main)
