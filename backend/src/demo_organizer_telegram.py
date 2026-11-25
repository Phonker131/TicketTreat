"""Private, owner-scoped Telegram activity alerts for event organizers.

The signed Telegram identity comes exclusively from the account-link table;
clients never supply a recipient ID. An immutable activity record and its
outbox entry are committed in the same transaction as the event mutation.
No email, phone, QR secret, chat body, or invitation token is sent to Telegram.
"""
from __future__ import annotations

import html
import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, Header
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.base import Base

LOG = logging.getLogger("tickettreat.organizer_telegram")

ACTIVITY_KINDS = {
    "registered": "registrations",
    "cancelled": "cancellations",
    "waitlist_joined": "waitlist",
    "waitlist_left": "waitlist",
    "promoted": "waitlist",
    "message": "messages",
}


class OrganizerTelegramSettings(Base):
    __tablename__ = "tt_organizer_telegram_settings"

    account_id = Column(Integer, ForeignKey("demo_web_accounts.id", ondelete="CASCADE"), primary_key=True)
    registrations = Column(Boolean, nullable=False, default=True, server_default="true")
    cancellations = Column(Boolean, nullable=False, default=True, server_default="true")
    waitlist = Column(Boolean, nullable=False, default=True, server_default="true")
    messages = Column(Boolean, nullable=False, default=True, server_default="true")


class OrganizerActivity(Base):
    __tablename__ = "tt_organizer_activity"

    id = Column(Integer, primary_key=True)
    dedup_key = Column(String(180), nullable=False, unique=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    guest_id = Column(Integer, nullable=True)  # Nullable for historical bot-only registrations.
    action = Column(String(24), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class SettingsUpdate(BaseModel):
    registrations: bool
    cancellations: bool
    waitlist: bool
    messages: bool


def _activity_recipients(db: Session, event_id: int, action: str) -> list[tuple[int, int]]:
    """Return only opted-in, verified Telegram destinations of the current team.

    A global admin does not receive a different organizer's guest activity.
    Every team member individually accepts an invitation and links Telegram
    using the signed account-link protocol. Revocation is rechecked on send.
    """
    from demo_account_bans import active_ban
    from demo_account_recovery import email_is_verified
    from demo_accounts import WebAccount
    from demo_roles import EventOwnership
    from demo_telegram import DemoTelegramIdentity
    from demo_organizer_teams import team_recipients

    ownership = db.get(EventOwnership, event_id)
    if ownership is None:
        return []
    result = []
    used_telegram_ids = set()
    for account_id in team_recipients(db, ownership.owner_account_id):
        account = db.get(WebAccount, account_id)
        if (account is None or not email_is_verified(db, account.id)
                or active_ban(db, account.id) is not None
                or not _enabled(db, account.id, action)):
            continue
        identity = db.query(DemoTelegramIdentity).filter(
            DemoTelegramIdentity.guest_id == account.guest_id).first()
        if identity is None or int(identity.telegram_id) in used_telegram_ids:
            continue
        used_telegram_ids.add(int(identity.telegram_id))
        result.append((int(account.id), int(identity.telegram_id)))
    return result


def _enabled(db: Session, account_id: int, action: str) -> bool:
    setting = db.get(OrganizerTelegramSettings, account_id)
    return setting is None or bool(getattr(setting, ACTIVITY_KINDS[action]))


def queue_organizer_activity(db: Session, *, event_id: int, action: str,
                             source_key: str, guest_id: int | None = None) -> bool:
    """Idempotently queue after a *real* state transition, before db.commit().

    source_key must identify a single transition (ticket issuance hash, cancel
    timestamp, message ID, etc.). It is never taken from an unauthenticated
    request and is never used as a URL or message body.
    """
    if action not in ACTIVITY_KINDS:
        raise ValueError("invalid_organizer_activity")
    if not source_key or len(source_key) > 110:
        raise ValueError("invalid_organizer_source_key")
    from demo_telegram_notifications import configured, _insert_rows
    if not configured():
        return False
    recipients = _activity_recipients(db, event_id, action)
    if not recipients:
        return False
    key = f"org:{event_id}:{action}:{source_key}"
    activity_id = db.execute(pg_insert(OrganizerActivity.__table__).values(
        dedup_key=key, event_id=event_id, guest_id=guest_id, action=action,
        created_at=datetime.now(timezone.utc),
    ).on_conflict_do_nothing(index_elements=["dedup_key"]).returning(OrganizerActivity.id)).scalar_one_or_none()
    if activity_id is None:
        return False
    now = datetime.now(timezone.utc)
    _insert_rows(db, [{
        "event_key": f"tg:organizer_activity:{activity_id}:{telegram_id}",
        "kind": "organizer_activity", "telegram_id": telegram_id,
        "event_id": event_id, "notice_id": activity_id,
        "language": "en", "state": "pending", "attempts": 0,
        "next_attempt_at": now,
    } for _, telegram_id in recipients])
    return True


HEADINGS = {
    "en": {
        "registered": "✅ New registration", "cancelled": "❌ Registration cancelled",
        "waitlist_joined": "⏳ Joined the waitlist", "waitlist_left": "↩️ Left the waitlist",
        "promoted": "🎟️ Guest promoted from waitlist", "message": "💬 New message from an attendee",
    },
    "cs": {
        "registered": "✅ Nová registrace", "cancelled": "❌ Zrušená registrace",
        "waitlist_joined": "⏳ Nový zájemce na čekací listině", "waitlist_left": "↩️ Odchod z čekací listiny",
        "promoted": "🎟️ Host převeden z čekací listiny", "message": "💬 Nová zpráva od účastníka",
    },
}


def render_organizer_activity(db: Session, row, event, main):
    """Revalidate access, preference and source before sending a private alert."""
    from demo_telegram_notifications import _recipient_languages, venue_start, PRAGUE
    activity = db.get(OrganizerActivity, row.notice_id) if row.notice_id else None
    if (activity is None or activity.event_id != row.event_id or event.id != row.event_id
            or activity.action not in ACTIVITY_KINDS):
        return None
    recipients = _activity_recipients(db, event.id, activity.action)
    if not any(telegram_id == row.telegram_id for _, telegram_id in recipients):
        return None
    language = _recipient_languages(db, [int(row.telegram_id)], main).get(int(row.telegram_id))
    lang = "cs" if language == "cs" else "en"
    title = html.escape(str(event.title or "Event")[:180])
    lines = [f"<b>{HEADINGS[lang][activity.action]}</b>", f"🎫 <b>{title}</b>"]
    start = venue_start(event)
    if start is not None:
        lines.append(f"🗓 {start.astimezone(PRAGUE).strftime('%d.%m.%Y %H:%M')}")
    if activity.guest_id is not None:
        guest = db.get(main.DemoGuest, activity.guest_id)
        if guest is not None and guest.first_name != "Erased":
            # A short display name is enough; contacts and private text stay on the site.
            name = str(guest.first_name or "").strip()[:60]
            initial = str(guest.last_name or "").strip()[:1]
            safe_name = html.escape(name + (f" {initial}." if initial else ""))
            if safe_name:
                lines.append(f"👤 {safe_name}")
    if activity.action in {"registered", "cancelled", "promoted"}:
        count = main.get_registered_count(db, event.id)
        lines.append((f"👥 Registrovaní: {count}" if lang == "cs"
                      else f"👥 Registered: {count}"))
    site = os.getenv("WEB_APP_URL", "").strip().rstrip("/") or "https://tickettreat.eu"
    if not site.startswith("https://"):
        site = "https://tickettreat.eu"
    label = "Otevřít správu akce" if lang == "cs" else "Open event management"
    keyboard = {"inline_keyboard": [[{"text": label, "url": f"{site}/admin/events/{int(event.id)}"}]]}
    return "\n".join(lines)[:4000], keyboard


def install_organizer_telegram_api(app, get_db):
    from demo_roles import account_lookup, ensure_manage

    def manager(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        account = account_lookup(db, authorization)  # Includes active ban and MFA guards.
        ensure_manage(db, account)
        return account

    def response(db, account):
        from demo_telegram import DemoTelegramIdentity
        setting = db.get(OrganizerTelegramSettings, account.id)
        linked = db.query(DemoTelegramIdentity.telegram_id).filter(
            DemoTelegramIdentity.guest_id == account.guest_id).first() is not None
        return {"telegram_linked": linked, "bot_configured": bool(os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()),
                **{field: bool(getattr(setting, field)) if setting else True
                   for field in ("registrations", "cancellations", "waitlist", "messages")}}

    @app.get("/demo/manage/telegram-notifications")
    def get_settings(account=Depends(manager), db: Session = Depends(get_db)):
        return response(db, account)

    @app.put("/demo/manage/telegram-notifications")
    def put_settings(payload: SettingsUpdate, account=Depends(manager), db: Session = Depends(get_db)):
        setting = db.get(OrganizerTelegramSettings, account.id)
        if setting is None:
            setting = OrganizerTelegramSettings(account_id=account.id)
            db.add(setting)
        for field, value in payload.model_dump().items():
            setattr(setting, field, value)
        db.commit()
        return response(db, account)
