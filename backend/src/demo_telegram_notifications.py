"""Durable TicketTreat operational Telegram notifications.

Cancellation, event updates and organizer notices share a database transaction
with the triggering operation. Reminders use organizer-defined intervals and
current bot registrations / signed Mini App identities. No email-based linking,
marketing automation, password codes, or retrospective mass notifications.
"""
from __future__ import annotations

import html
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text, and_, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.base import Base

LOG = logging.getLogger("tickettreat.telegram_notifications")
PRAGUE = ZoneInfo("Europe/Prague")
MAX_ATTEMPTS = 6
MAX_RECIPIENTS = 50000


class TelegramReminderBatch(Base):
    """One atomic queueing pass per event, start time and selected interval."""
    __tablename__ = "demo_telegram_reminder_batches"
    event_id = Column(Integer, primary_key=True)
    start_epoch = Column(BigInteger, primary_key=True)
    reminder_minutes = Column(Integer, primary_key=True)
    queued_at = Column(DateTime(timezone=True), nullable=False)


class TelegramNotificationOutbox(Base):
    __tablename__ = "demo_telegram_notification_outbox"

    id = Column(Integer, primary_key=True)
    event_key = Column(String(180), nullable=False, unique=True, index=True)
    kind = Column(String(24), nullable=False)
    telegram_id = Column(BigInteger, nullable=False, index=True)
    event_id = Column(Integer, nullable=False, index=True)
    notice_id = Column(Integer, nullable=True)
    start_epoch = Column(BigInteger, nullable=True)
    reminder_minutes = Column(Integer, nullable=True)
    language = Column(String(2), nullable=False, default="en")
    state = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False)
    last_error = Column(String(200), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)


def configured() -> bool:
    return bool(os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip())


def venue_start(event) -> datetime | None:
    if event.starts_at is None:
        return None
    dt = event.starts_at
    return dt.replace(tzinfo=PRAGUE).astimezone(timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def recipient_ids(db: Session, event_id: int, main) -> list[int]:
    """Active attendees only, deduping bot registrations and signed Mini App links.

    Historical bot registrations with cancelled/invalid QR claims are excluded.
    Do not use DemoGuest.telegram_id: anonymous clients can populate it.
    """
    from demo_broadcast import _audience
    _emails, ids = _audience(db, "event", event_id, main)
    if len(ids) > MAX_RECIPIENTS:
        raise ValueError("telegram_audience_too_large")
    return ids


def _recipient_languages(db: Session, ids: list[int], main) -> dict[int, str]:
    if not ids:
        return {}
    languages = {}
    for offset in range(0, len(ids), 500):
        rows = db.query(main.UserLanguageSetting.telegram_id, main.UserLanguageSetting.language).filter(
            main.UserLanguageSetting.telegram_id.in_(ids[offset:offset + 500])
        ).all()
        for tg_id, lang in rows:
            languages[int(tg_id)] = lang if lang in {"ru", "uk", "cs", "en"} else "en"
    return languages


def _insert_rows(db: Session, rows: list[dict]) -> None:
    for start in range(0, len(rows), 400):
        # PostgreSQL unique event_key is also safe with several API replicas.
        db.execute(pg_insert(TelegramNotificationOutbox.__table__)
                   .values(rows[start:start + 400])
                   .on_conflict_do_nothing(index_elements=["event_key"]))


def queue_notice(db: Session, *, notice, event, main) -> int:
    """Atomic with the organizer's event update / cancellation transaction."""
    if not configured():
        return 0
    ids = recipient_ids(db, event.id, main)
    now = datetime.now(timezone.utc)
    languages = _recipient_languages(db, ids, main)
    rows = [
        {
            "event_key": f"tg:notice:{notice.id}:{tg_id}",
            "kind": "event_notice",
            "telegram_id": tg_id,
            "event_id": event.id,
            "notice_id": notice.id,
            "language": languages.get(tg_id, "en"),
            "state": "pending",
            "attempts": 0,
            "next_attempt_at": now,
        }
        for tg_id in ids
    ]
    if rows:
        _insert_rows(db, rows)
    return len(rows)


def reminder_offsets(db: Session, event) -> list[int]:
    """Use modern multi-offset settings, preserving legacy bot custom reminders."""
    from demo_pilot_ops import EventPilotSettings, effective_settings
    configured_settings = db.get(EventPilotSettings, event.id)
    if configured_settings is None:
        legacy = getattr(event, "reminder_minutes_before", None)
        if isinstance(legacy, int) and 15 <= legacy <= 10080:
            return [legacy]
    return effective_settings(db, event.id)["reminder_minutes"]


def queue_reminders_for_event(db: Session, *, event, main, now: datetime | None = None) -> int:
    """Materialize selected future reminder times in a durable, idempotent queue.

    Ran by the worker, not by user-triggered requests. Never backfill old
    historical reminders. The outbox is checked again at delivery time to
    suppress cancellations, changed start times, or withdrawn registration.
    """
    if not configured() or event.is_cancelled:
        return 0
    now = now or datetime.now(timezone.utc)
    start = venue_start(event)
    if start is None or start <= now + timedelta(minutes=15):
        return 0
    offsets = reminder_offsets(db, event)
    # Queue only when an interval becomes due. Batches prevent replaying tens
    # of thousands of inserts every minute for the next seven days.
    upcoming = [
        (int(minutes), start - timedelta(minutes=int(minutes)))
        for minutes in offsets
        if 15 <= int(minutes) <= 10080
        and now - timedelta(minutes=15) <= start - timedelta(minutes=int(minutes)) <= now + timedelta(seconds=75)
    ]
    if not upcoming:
        return 0
    ids = recipient_ids(db, event.id, main)
    if not ids:
        return 0
    languages = _recipient_languages(db, ids, main)
    epoch = int(start.timestamp())
    queued = 0
    for minutes, at in upcoming:
        inserted = db.execute(
            pg_insert(TelegramReminderBatch.__table__).values(
                event_id=event.id, start_epoch=epoch, reminder_minutes=minutes, queued_at=now
            ).on_conflict_do_nothing(
                index_elements=["event_id", "start_epoch", "reminder_minutes"]
            ).returning(TelegramReminderBatch.event_id)
        ).scalar_one_or_none()
        if inserted is None:
            continue
        rows = [
            {
                "event_key": f"tg:reminder:{event.id}:{epoch}:{minutes}:{tg_id}",
                "kind": "reminder",
                "telegram_id": tg_id,
                "event_id": event.id,
                "start_epoch": epoch,
                "reminder_minutes": minutes,
                "language": languages.get(tg_id, "en"),
                "state": "pending",
                "attempts": 0,
                "next_attempt_at": at if at > now else now,
            }
            for tg_id in ids
        ]
        _insert_rows(db, rows)
        queued += len(rows)
    return queued


def _still_registered(db: Session, *, telegram_id: int, event_id: int, main) -> bool:
    """Cheap per-recipient validation right before reminder delivery."""
    from demo_legacy import LegacyTicketClaim
    from demo_telegram import DemoTelegramIdentity

    linked = db.query(main.DemoTicket.id).join(
        DemoTelegramIdentity,
        DemoTelegramIdentity.guest_id == main.DemoTicket.guest_id,
    ).filter(
        DemoTelegramIdentity.telegram_id == telegram_id,
        main.DemoTicket.event_id == event_id,
        main.DemoTicket.ticket_status == "active",
    ).first()
    if linked:
        return True
    legacy = db.query(main.Registration.id).join(
        main.User, main.User.id == main.Registration.user_id,
    ).outerjoin(
        LegacyTicketClaim, LegacyTicketClaim.registration_id == main.Registration.id,
    ).outerjoin(
        main.DemoTicket, main.DemoTicket.id == LegacyTicketClaim.ticket_id,
    ).filter(
        main.User.telegram_id == telegram_id,
        main.Registration.event_id == event_id,
        or_(
            LegacyTicketClaim.registration_id.is_(None),
            main.DemoTicket.ticket_status == "active",
        ),
    ).first()
    return bool(legacy)


COPY = {
    "en": ("Event cancelled", "Event details updated", "Important information from the organizer", "Event reminder",
           "Reason", "Message from the organizer", "Date", "Location", "View event"),
    "cs": ("Akce byla zrušena", "Informace o akci byly změněny", "Důležité informace od pořadatele", "Připomenutí akce",
           "Důvod", "Zpráva od pořadatele", "Datum", "Místo", "Zobrazit akci"),
    "ru": ("Мероприятие отменено", "Информация о мероприятии изменена", "Важная информация от организатора", "Напоминание о мероприятии",
           "Причина", "Сообщение организатора", "Дата", "Место", "Открыть мероприятие"),
    "uk": ("Подію скасовано", "Інформацію про подію оновлено", "Важлива інформація від організатора", "Нагадування про подію",
           "Причина", "Повідомлення організатора", "Дата", "Місце", "Відкрити подію"),
}


def render_message(row: TelegramNotificationOutbox, event, notice) -> tuple[str, dict]:
    """HTML escape event/organizer input before passing to Telegram."""
    lang = row.language if row.language in COPY else "en"
    cancel, change, announcement, reminder, reason, message, date, location, button = COPY[lang]
    title = html.escape(str(event.title or "Event")[:180])
    if row.kind == "event_notice":
        if notice is None or notice.event_id != event.id:
            raise ValueError("notice_missing")
        if notice.kind not in {"cancel", "change", "announcement"}:
            raise ValueError("notice_invalid")
        heading = {"cancel": cancel, "change": change, "announcement": announcement}[notice.kind]
        label = reason if notice.kind == "cancel" else message
        body = str(notice.message or "").strip()
    else:
        heading = reminder
        label = message
        body = str(getattr(event, "reminder_text", "") or "").strip()
    sections = [
        f"<b>{html.escape(heading)}</b>",
        f"🎟 <b>{title}</b>",
    ]
    if event.starts_at is not None:
        dt = venue_start(event).astimezone(PRAGUE)
        sections.append(f"🕒 {html.escape(date)}: {dt.strftime('%d.%m.%Y %H:%M')} (Europe/Prague)")
    if getattr(event, "location", None):
        sections.append(f"📍 {html.escape(location)}: {html.escape(str(event.location)[:300])}")
    if body:
        sections.append(f"<b>{html.escape(label)}:</b>\n{html.escape(body[:1500])}")
    url = (os.getenv("WEB_APP_URL", "").strip().rstrip("/") or "https://tickettreat.eu")
    if not url.startswith("https://"):
        url = "https://tickettreat.eu"
    link = f"{url}/events/{int(event.id)}"
    keyboard = {"inline_keyboard": [[{"text": "🎟 " + button, "url": link}]]}
    return "\n\n".join(sections)[:4000], keyboard


def _send_message(telegram_id: int, text: str, keyboard: dict) -> None:
    token = os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("telegram_unavailable")
    body = {
        "chat_id": telegram_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": keyboard,
    }
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            result = json.loads(response.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError("telegram_rejected_request")
    except urllib.error.HTTPError as exc:
        if exc.code in {400, 403}:
            raise ValueError("telegram_chat_unavailable") from None
        if exc.code == 429:
            raise RuntimeError("telegram_rate_limited") from None
        raise RuntimeError("telegram_http_%s" % exc.code) from None
    except urllib.error.URLError:
        raise RuntimeError("telegram_network_unavailable") from None


def _deliver_one(db: Session, main) -> bool:
    now = datetime.now(timezone.utc)
    row = db.query(TelegramNotificationOutbox).filter(
        TelegramNotificationOutbox.state == "pending",
        TelegramNotificationOutbox.attempts < MAX_ATTEMPTS,
        TelegramNotificationOutbox.next_attempt_at <= now,
    ).order_by(TelegramNotificationOutbox.id).with_for_update(skip_locked=True).first()
    if row is None:
        return False
    row.attempts += 1
    try:
        event = db.get(main.Event, row.event_id)
        if event is None:
            row.state = "skipped"
        elif row.kind == "reminder":
            start = venue_start(event)
            offsets = reminder_offsets(db, event)
            if (
                event.is_cancelled or start is None or now >= start
                or int(start.timestamp()) != row.start_epoch
                or row.reminder_minutes not in offsets
                or not _still_registered(db, telegram_id=row.telegram_id, event_id=event.id, main=main)
            ):
                row.state = "skipped"
            else:
                text, keyboard = render_message(row, event, None)
                _send_message(int(row.telegram_id), text, keyboard)
                row.state = "sent"
        elif row.kind == "event_notice":
            from demo_email import EventNotice
            notice = db.get(EventNotice, row.notice_id)
            if notice is None or (event.is_cancelled and notice.kind != "cancel"):
                row.state = "skipped"
            else:
                text, keyboard = render_message(row, event, notice)
                _send_message(int(row.telegram_id), text, keyboard)
                row.state = "sent"
        else:
            row.state = "skipped"
        if row.state == "sent":
            row.sent_at = datetime.now(timezone.utc)
            row.last_error = None
    except ValueError:
        row.state = "skipped"
        row.last_error = "chat_unavailable_or_invalid_notice"
    except Exception as exc:
        # Never log bot tokens, chat IDs, message contents or secrets.
        row.last_error = str(exc)[:200]
        if row.attempts >= MAX_ATTEMPTS:
            row.state = "failed"
        else:
            delay = 90 if str(exc) == "telegram_rate_limited" else min(3600, 15 * (2 ** row.attempts))
            row.next_attempt_at = now + timedelta(seconds=delay)
    db.commit()
    return True


def _materialize_upcoming(db: Session, main) -> int:
    now = datetime.now(timezone.utc)
    local = now.astimezone(PRAGUE).replace(tzinfo=None)
    events = db.query(main.Event).filter(
        main.Event.starts_at >= local + timedelta(minutes=15),
        main.Event.starts_at <= local + timedelta(days=8),
        or_(main.Event.is_cancelled.is_(False), main.Event.is_cancelled.is_(None)),
    ).order_by(main.Event.starts_at, main.Event.id).limit(5000).all()
    total = 0
    for event in events:
        total += queue_reminders_for_event(db, event=event, main=main, now=now)
    db.commit()
    return total


_started = False
_start_lock = threading.Lock()


def install_notification_worker(app, session_factory, main) -> None:
    @app.on_event("startup")
    def start_telegram_notification_worker():
        global _started
        if not configured() or os.getenv("DEMO_ISOLATED_API", "false").lower() != "true":
            LOG.info("Telegram operational notifications disabled/not configured.")
            return
        with _start_lock:
            if _started:
                return
            _started = True

        def run():
            LOG.info("TicketTreat Telegram operational notification worker started.")
            last_sync = 0.0
            while True:
                try:
                    if time.monotonic() - last_sync >= 60:
                        with session_factory() as db:
                            _materialize_upcoming(db, main)
                        last_sync = time.monotonic()
                    # Rate-limited to 5 msg/sec; Telegram group limits can be lower.
                    for _ in range(5):
                        with session_factory() as db:
                            if not _deliver_one(db, main):
                                break
                        time.sleep(0.2)
                except Exception:
                    LOG.exception("Telegram operational notification worker cycle failed")
                time.sleep(1)

        threading.Thread(target=run, daemon=True, name="tickettreat-telegram-notifications").start()
