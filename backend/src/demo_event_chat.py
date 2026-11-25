"""Private, event-scoped organizer conversations shared by web and Telegram Mini App.

The sender never supplies a guest, account, event owner or recipient. Every
request derives identity from a signed website session or Telegram initData.
An unrelated organizer receives 404, and user messages are never mixed into
TicketTreat's global support desk. No HTML, uploads or shared guest tokens.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (
    CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.base import Base
from demo_roles import EventOwnership, account_lookup, ensure_manage, role_for

MAX_TEXT = 2000
PAGE_SIZE = 60


def utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def timestamp() -> datetime:
    return datetime.now(timezone.utc)


class EventChatThread(Base):
    __tablename__ = "tt_event_chat_threads"
    __table_args__ = (
        UniqueConstraint("event_id", "guest_id", name="uq_tt_event_chat_guest"),
        CheckConstraint("status IN ('open','closed')", name="ck_tt_chat_status"),
        CheckConstraint("(status='open' AND closed_at IS NULL AND closed_by IS NULL) OR (status='closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)", name="ck_tt_chat_closed"),
    )

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    guest_id = Column(Integer, ForeignKey("demo_guests.id"), nullable=False, index=True)
    status = Column(String(8), nullable=False, default="open")
    created_at = Column(DateTime(timezone=True), nullable=False, default=timestamp)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=timestamp, index=True)
    last_participant_message_id = Column(Integer, nullable=True)
    last_organizer_message_id = Column(Integer, nullable=True)
    guest_read_message_id = Column(Integer, nullable=True)
    organizer_read_message_id = Column(Integer, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    closed_by = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)


class EventChatMessage(Base):
    __tablename__ = "tt_event_chat_messages"
    __table_args__ = (
        UniqueConstraint("thread_id", "sender_kind", "client_nonce", name="uq_tt_event_chat_send"),
        CheckConstraint("sender_kind IN ('participant','organizer')", name="ck_tt_chat_sender"),
        CheckConstraint("length(btrim(body)) BETWEEN 2 AND 2000", name="ck_tt_chat_body"),
        CheckConstraint("(sender_kind='participant' AND sender_account_id IS NULL) OR (sender_kind='organizer' AND sender_account_id IS NOT NULL)", name="ck_tt_chat_author"),
    )

    id = Column(Integer, primary_key=True)
    thread_id = Column(Integer, ForeignKey("tt_event_chat_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_kind = Column(String(12), nullable=False)
    sender_account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)
    body = Column(Text, nullable=False)
    client_nonce = Column(String(36), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=timestamp)


class SendMessage(BaseModel):
    body: str = Field(min_length=2, max_length=MAX_TEXT)
    client_nonce: str = Field(pattern=r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")


class SetChatStatus(BaseModel):
    closed: bool


def verified_guest(db: Session, main, authorization: str | None, init_data: str | None):
    """Mirror authenticated guest identity used by /demo/me/tickets.

    Telegram-only sessions do not require an email; arbitrary DemoGuest tokens
    and unsigned TG IDs are never accepted. Staff account sessions require MFA.
    """
    if init_data:
        from demo_telegram import verified_telegram_user, DemoTelegramIdentity
        tg = verified_telegram_user(
            init_data, os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip())
        identity = db.query(DemoTelegramIdentity).filter(
            DemoTelegramIdentity.telegram_id == tg["id"]).first()
        if identity is None:
            raise HTTPException(401, "telegram_login_required")
        guest = db.get(main.DemoGuest, identity.guest_id)
    else:
        from demo_mfa import session_for, require_privileged_mfa
        from demo_account_recovery import email_is_verified
        from demo_telegram import DemoTelegramIdentity
        account, session = session_for(db, authorization)
        require_privileged_mfa(db, account, session)
        if not email_is_verified(db, account.id):
            if not (account.email is None and account.password_hash == "!telegram-only"
                    and role_for(db, account) == "participant"
                    and db.query(DemoTelegramIdentity.telegram_id).filter(
                        DemoTelegramIdentity.guest_id == account.guest_id).first()):
                raise HTTPException(403, "email_verification_required")
        guest = db.get(main.DemoGuest, account.guest_id)
    if guest is None:
        raise HTTPException(401, "identity_profile_missing")
    # Verified Telegram initData proves identity, not continued eligibility.
    # Web sessions already check account bans; apply the same policy to the
    # Telegram path so a banned guest cannot keep messaging organizers.
    from demo_account_bans import require_verified_guest_active
    require_verified_guest_active(db, guest.id)
    return guest


def require_staff_thread(db: Session, thread_id: int, staff):
    ensure_manage(db, staff)
    thread = db.get(EventChatThread, thread_id)
    if thread is None:
        raise HTTPException(404, "conversation_not_found")
    owner = db.get(EventOwnership, thread.event_id)
    if owner is None:
        raise HTTPException(404, "conversation_not_found")
    if role_for(db, staff) != "global_admin" and int(owner.owner_account_id) != staff.id:
        raise HTTPException(404, "conversation_not_found")
    return thread


def require_guest_thread(db: Session, thread_id: int, guest):
    thread = db.query(EventChatThread).filter(
        EventChatThread.id == thread_id,
        EventChatThread.guest_id == guest.id).first()
    if thread is None:
        raise HTTPException(404, "conversation_not_found")
    return thread


def allow_new_thread(db: Session, event_id: int, presented: str | None, main):
    from demo_event_access import require_invite
    from demo_publication import require_published
    event = db.get(main.Event, event_id)
    # Public discovery deliberately omits events that have already started.
    # A direct event ID must not bypass that lifecycle and create new chats.
    if event is None or event.is_cancelled or event.starts_at is None or main.event_is_past(event):
        raise HTTPException(404, "event_not_found")
    require_published(db, event_id)
    require_invite(db, event_id, presented)
    owner = db.get(EventOwnership, event_id)
    if owner is None:
        raise HTTPException(404, "organizer_chat_unavailable")
    return event


def ensure_chat_writable(db: Session, thread: EventChatThread, main) -> None:
    """Keep historic threads readable, but do not revive unavailable events."""
    from demo_publication import state
    from demo_account_bans import require_guest_active

    # Applies to organizer replies as well as participant replies. A banned
    # guest must not receive new notifications through a still-open thread.
    require_guest_active(db, thread.guest_id)
    event = db.get(main.Event, thread.event_id)
    if (event is None or event.is_cancelled or event.starts_at is None
            or main.event_is_past(event) or not state(db, thread.event_id)["visible"]):
        raise HTTPException(409, "conversation_unavailable")


def serialized_thread(db: Session, thread: EventChatThread, main, *, staff: bool):
    event = db.get(main.Event, thread.event_id)
    owner = db.get(EventOwnership, thread.event_id)
    guest = db.get(main.DemoGuest, thread.guest_id) if staff else None
    other_latest = thread.last_participant_message_id if staff else thread.last_organizer_message_id
    other_seen = thread.organizer_read_message_id if staff else thread.guest_read_message_id
    return {
        "id": thread.id, "event_id": thread.event_id,
        "event_title": event.title if event else "Event",
        "organizer": str(event.organizer or "TicketTreat organizer") if event else "Organizer",
        "organizer_account_id": owner.owner_account_id if owner else None,
        "participant_name": " ".join(filter(None, [guest.first_name, guest.last_name]))[:120] if guest else None,
        "status": thread.status, "created_at": utc(thread.created_at).isoformat(),
        "updated_at": utc(thread.updated_at).isoformat(),
        "unread": bool(other_latest is not None and other_latest > (other_seen or 0)),
    }


def serialized_message(msg: EventChatMessage):
    return {
        "id": msg.id, "sender_kind": msg.sender_kind, "body": msg.body,
        "created_at": utc(msg.created_at).isoformat(),
        "client_nonce": msg.client_nonce,
    }


def detail(db: Session, thread: EventChatThread, main, *, staff: bool, before: int | None = None):
    q = db.query(EventChatMessage).filter(EventChatMessage.thread_id == thread.id)
    if before is not None:
        q = q.filter(EventChatMessage.id < before)
    rows = q.order_by(EventChatMessage.id.desc()).limit(PAGE_SIZE + 1).all()
    has_more = len(rows) > PAGE_SIZE
    messages = rows[:PAGE_SIZE]
    messages.reverse()
    return {"thread": serialized_thread(db, thread, main, staff=staff),
            "messages": [serialized_message(msg) for msg in messages],
            "has_more": has_more}


def rate_limit(db: Session, thread: EventChatThread, *, staff: bool, sender_id: int | None = None):
    t = timestamp()
    if staff:
        q = db.query(EventChatMessage).filter(
            EventChatMessage.sender_kind == "organizer",
            EventChatMessage.sender_account_id == sender_id)
        day_limit = 300
    else:
        q = db.query(EventChatMessage).join(
            EventChatThread, EventChatThread.id == EventChatMessage.thread_id).filter(
            EventChatMessage.sender_kind == "participant",
            EventChatThread.guest_id == thread.guest_id)
        day_limit = 60
    if (q.filter(EventChatMessage.created_at >= t - timedelta(days=1)).count() >= day_limit):
        raise HTTPException(429, "chat_daily_limit")
    latest = q.order_by(EventChatMessage.created_at.desc(), EventChatMessage.id.desc()).first()
    if latest and utc(latest.created_at) > t - timedelta(seconds=2):
        raise HTTPException(429, "chat_slow_down")


def queue_chat_notification(db: Session, thread, msg, main):
    """Queue one notification for the first unread message, atomically with send.

    Failure of Resend/Telegram never rolls back an already-saved conversation.
    Notification contains only an event title/link, never message contents.
    """
    from demo_accounts import WebAccount
    from demo_account_recovery import email_is_verified
    from demo_email import queue_email
    from demo_telegram import DemoTelegramIdentity
    from demo_telegram_notifications import TelegramNotificationOutbox, configured as tg_configured, _insert_rows
    from demo_account_bans import banned_guest_ids

    if thread.guest_id in banned_guest_ids(db, [thread.guest_id]):
        return

    owner = db.get(EventOwnership, thread.event_id)
    if owner is None:
        return
    recipient = (db.query(WebAccount).filter(
        WebAccount.guest_id == thread.guest_id).first()
        if msg.sender_kind == "organizer" else db.get(WebAccount, owner.owner_account_id))
    if recipient and recipient.email and email_is_verified(db, recipient.id):
        queue_email(db, kind="organizer_chat", event_key=f"chat:mail:{msg.id}",
                    recipient=recipient.email)
        # demo_email_outbox.notice_id has a database FK to demo_event_notices.
        # Chat message IDs are a different entity; resolve by event_key in the worker.
    if msg.sender_kind == "organizer" and tg_configured():
        identity = db.query(DemoTelegramIdentity).filter(
            DemoTelegramIdentity.guest_id == thread.guest_id).first()
        if identity is not None:
            _insert_rows(db, [{
                "event_key": f"tg:chat:{msg.id}",
                "kind": "organizer_chat", "telegram_id": int(identity.telegram_id),
                "event_id": thread.event_id, "notice_id": msg.id, "language": "en",
                "state": "pending", "attempts": 0, "next_attempt_at": timestamp(),
            }])
    elif msg.sender_kind == "participant":
        from demo_organizer_telegram import queue_organizer_activity
        queue_organizer_activity(db, event_id=thread.event_id, action="message",
                                 source_key=f"chat:{msg.id}", guest_id=thread.guest_id)


def send(db: Session, thread_id: int, payload: SendMessage, main, *,
         staff: bool, sender_id: int | None = None):
    thread = db.query(EventChatThread).filter(
        EventChatThread.id == thread_id).with_for_update().first()
    if thread is None:
        raise HTTPException(404, "conversation_not_found")
    body = payload.body.strip()
    if not 2 <= len(body) <= MAX_TEXT:
        raise HTTPException(422, "chat_invalid_message")
    if thread.status != "open":
        raise HTTPException(409, "conversation_closed")
    ensure_chat_writable(db, thread, main)
    author = "organizer" if staff else "participant"
    previous = db.query(EventChatMessage).filter(
        EventChatMessage.thread_id == thread.id,
        EventChatMessage.sender_kind == author,
        EventChatMessage.client_nonce == payload.client_nonce).first()
    if previous:
        return {"message": serialized_message(previous), "duplicate": True}
    rate_limit(db, thread, staff=staff, sender_id=sender_id)
    # Idempotency key belongs to the authenticated sender and this thread.
    message = EventChatMessage(thread_id=thread.id, sender_kind=author,
                               sender_account_id=sender_id if staff else None,
                               body=body, client_nonce=payload.client_nonce,
                               created_at=timestamp())
    db.add(message)
    db.flush()
    before_unread = ((thread.last_organizer_message_id or 0) > (thread.guest_read_message_id or 0)
                     if staff else
                     (thread.last_participant_message_id or 0) > (thread.organizer_read_message_id or 0))
    if staff:
        thread.last_organizer_message_id = message.id
    else:
        thread.last_participant_message_id = message.id
    thread.updated_at = timestamp()
    if not before_unread:
        queue_chat_notification(db, thread, message, main)
    db.commit()
    return {"message": serialized_message(message), "duplicate": False}


def install_event_chat_api(app, get_db, main):
    def guest_user(authorization: str | None = Header(default=None),
                   x_telegram_init_data: str | None = Header(default=None),
                   db: Session = Depends(get_db)):
        return verified_guest(db, main, authorization, x_telegram_init_data)

    def staff_user(authorization: str | None = Header(default=None),
                   db: Session = Depends(get_db)):
        staff = account_lookup(db, authorization)
        ensure_manage(db, staff)
        return staff

    @app.get("/demo/me/chats")
    def my_threads(guest=Depends(guest_user), db: Session = Depends(get_db)):
        rows = db.query(EventChatThread).filter(EventChatThread.guest_id == guest.id).order_by(
            EventChatThread.updated_at.desc(), EventChatThread.id.desc()).limit(100).all()
        return {"threads": [serialized_thread(db, row, main, staff=False) for row in rows]}

    @app.get("/demo/me/events/{event_id}/chat")
    def event_thread(event_id: int, x_event_invite: str | None = Header(default=None),
                     guest=Depends(guest_user), db: Session = Depends(get_db)):
        row = db.query(EventChatThread).filter(
            EventChatThread.event_id == event_id,
            EventChatThread.guest_id == guest.id).first()
        if row:
            return detail(db, row, main, staff=False)
        event = allow_new_thread(db, event_id, x_event_invite, main)
        return {"thread": None, "messages": [], "has_more": False,
                "event": {"id": event.id, "title": event.title}}

    @app.post("/demo/me/events/{event_id}/chat/messages", status_code=201)
    def first_message(event_id: int, payload: SendMessage,
                      x_event_invite: str | None = Header(default=None),
                      guest=Depends(guest_user), db: Session = Depends(get_db)):
        row = db.query(EventChatThread).filter(
            EventChatThread.event_id == event_id,
            EventChatThread.guest_id == guest.id).first()
        if row is None:
            allow_new_thread(db, event_id, x_event_invite, main)
            # DB uniqueness handles concurrent first sends by the same guest,
            # including simultaneous web and Mini App requests.
            db.execute(pg_insert(EventChatThread.__table__).values(
                event_id=event_id, guest_id=guest.id, status="open",
                created_at=timestamp(), updated_at=timestamp()
            ).on_conflict_do_nothing(index_elements=["event_id", "guest_id"]))
            row = db.query(EventChatThread).filter(
                EventChatThread.event_id == event_id,
                EventChatThread.guest_id == guest.id).first()
        return send(db, row.id, payload, main, staff=False)

    @app.get("/demo/me/chats/{thread_id}")
    def my_thread(thread_id: int, before: int | None = None,
                  guest=Depends(guest_user), db: Session = Depends(get_db)):
        if before is not None and before <= 0:
            raise HTTPException(422, "chat_invalid_cursor")
        return detail(db, require_guest_thread(db, thread_id, guest), main, staff=False, before=before)

    @app.post("/demo/me/chats/{thread_id}/messages", status_code=201)
    def guest_reply(thread_id: int, payload: SendMessage,
                    guest=Depends(guest_user), db: Session = Depends(get_db)):
        row = require_guest_thread(db, thread_id, guest)
        return send(db, row.id, payload, main, staff=False)

    @app.post("/demo/me/chats/{thread_id}/read")
    def guest_read(thread_id: int, guest=Depends(guest_user), db: Session = Depends(get_db)):
        row = db.query(EventChatThread).filter(
            EventChatThread.id == thread_id, EventChatThread.guest_id == guest.id
        ).with_for_update().first()
        if row is None:
            raise HTTPException(404, "conversation_not_found")
        row.guest_read_message_id = max(row.guest_read_message_id or 0,
                                        row.last_organizer_message_id or 0) or None
        db.commit()
        return {"status": "read"}

    @app.get("/demo/manage/chats")
    def organizer_threads(staff=Depends(staff_user), db: Session = Depends(get_db)):
        q = db.query(EventChatThread).join(
            EventOwnership, EventOwnership.event_id == EventChatThread.event_id)
        if role_for(db, staff) != "global_admin":
            q = q.filter(EventOwnership.owner_account_id == staff.id)
        rows = q.order_by(EventChatThread.updated_at.desc(), EventChatThread.id.desc()).limit(150).all()
        result = [serialized_thread(db, row, main, staff=True) for row in rows]
        return {"threads": result, "unread": sum(1 for row in result if row["unread"])}

    @app.get("/demo/manage/chats/{thread_id}")
    def organizer_thread(thread_id: int, before: int | None = None,
                         staff=Depends(staff_user), db: Session = Depends(get_db)):
        if before is not None and before <= 0:
            raise HTTPException(422, "chat_invalid_cursor")
        return detail(db, require_staff_thread(db, thread_id, staff), main,
                      staff=True, before=before)

    @app.post("/demo/manage/chats/{thread_id}/messages", status_code=201)
    def organizer_reply(thread_id: int, payload: SendMessage,
                        staff=Depends(staff_user), db: Session = Depends(get_db)):
        row = require_staff_thread(db, thread_id, staff)
        return send(db, row.id, payload, main, staff=True, sender_id=staff.id)

    @app.post("/demo/manage/chats/{thread_id}/read")
    def organizer_read(thread_id: int, staff=Depends(staff_user), db: Session = Depends(get_db)):
        row = require_staff_thread(db, thread_id, staff)
        locked = db.query(EventChatThread).filter(
            EventChatThread.id == row.id).with_for_update().first()
        locked.organizer_read_message_id = max(
            locked.organizer_read_message_id or 0,
            locked.last_participant_message_id or 0) or None
        db.commit()
        return {"status": "read"}

    @app.post("/demo/manage/chats/{thread_id}/status")
    def organizer_status(thread_id: int, payload: SetChatStatus,
                         staff=Depends(staff_user), db: Session = Depends(get_db)):
        row = require_staff_thread(db, thread_id, staff)
        if not payload.closed:
            ensure_chat_writable(db, row, main)
        locked = db.query(EventChatThread).filter(
            EventChatThread.id == row.id).with_for_update().first()
        locked.status = "closed" if payload.closed else "open"
        locked.closed_at = timestamp() if payload.closed else None
        locked.closed_by = staff.id if payload.closed else None
        db.commit()
        return {"status": locked.status}


def render_chat_email(row, db: Session) -> dict | None:
    """No user-entered chat body in email; sender, recipient and link rechecked."""
    from demo_accounts import WebAccount
    from demo_account_recovery import email_is_verified
    from demo_email import email_shell, card
    from demo_account_bans import banned_guest_ids
    # A chat notification has no event notice. Its message id is encoded in
    # the idempotent event_key, not the FK-backed notice_id column.
    if row.kind != "organizer_chat" or row.notice_id is not None:
        return None
    match = re.fullmatch(r"chat:mail:([1-9][0-9]*)", row.event_key or "")
    if match is None:
        return None
    msg = db.get(EventChatMessage, int(match.group(1)))
    if msg is None:
        return None
    thread = db.get(EventChatThread, msg.thread_id)
    owner = db.get(EventOwnership, thread.event_id) if thread else None
    if thread is None or owner is None:
        return None
    if thread.guest_id in banned_guest_ids(db, [thread.guest_id]):
        return None
    if msg.sender_kind == "organizer":
        account = db.query(WebAccount).filter(WebAccount.guest_id == thread.guest_id).first()
        url = f"https://tickettreat.eu/messages?thread={thread.id}"
        title = "New reply from your event organizer"
        lead = "The organizer replied to your TicketTreat event conversation."
    else:
        account = db.get(WebAccount, owner.owner_account_id)
        url = f"https://tickettreat.eu/admin/messages?thread={thread.id}"
        title = "New participant message"
        lead = "A participant wrote to you about an event you manage."
    if (account is None or not account.email or not email_is_verified(db, account.id)
            or account.email.strip().casefold() != row.recipient.strip().casefold()):
        return None
    import main
    event = db.get(main.Event, thread.event_id)
    if event is None:
        return None
    details = card("Event", str(event.title or "Event")[:120])
    return {
        "from": os.environ["EMAIL_FROM"].strip(),
        "to": [row.recipient],
        "subject": "[TicketTreat] " + title,
        "html": email_shell(title, lead, details, url, "Open conversation",
                            "Sign in to respond. Do not share payment or account secrets in chat.",
                            "TicketTreat event conversation notification."),
        "text": f"{title}\n\n{lead}\nEvent: {str(event.title or 'Event')[:120]}\n\nOpen: {url}\n",
    }
