"""Audited, owner-scoped TicketTreat operational broadcasts (website + Telegram).

Never sends during a preview. Only the explicit confirmed POST enqueues work.
Marketing communications require a separate subscriber-consent workflow.
"""
from __future__ import annotations

import html
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text, func, and_, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from db.base import Base

LOG = logging.getLogger("tickettreat.broadcast")
MAX_AUDIENCE_PER_CHANNEL = 50000


class BroadcastCampaign(Base):
    __tablename__ = "demo_broadcast_campaigns"
    id = Column(Integer, primary_key=True)
    request_id = Column(String(36), unique=True, nullable=False)
    actor_account_id = Column(Integer, nullable=False, index=True)
    scope = Column(String(12), nullable=False)
    event_id = Column(Integer, nullable=True, index=True)
    subject = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    image_url = Column(String(1000), nullable=True)
    email_count = Column(Integer, nullable=False, default=0)
    telegram_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class BroadcastTelegramOutbox(Base):
    __tablename__ = "demo_broadcast_telegram_outbox"
    id = Column(Integer, primary_key=True)
    campaign_id = Column(Integer, ForeignKey("demo_broadcast_campaigns.id"), nullable=False, index=True)
    telegram_id = Column(BigInteger, nullable=False)
    state = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    next_attempt_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_error = Column(String(200), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class AudienceRequest(BaseModel):
    scope: Literal["global", "event"]
    event_id: int | None = Field(default=None, gt=0)


class BroadcastSend(AudienceRequest):
    request_id: str = Field(min_length=32, max_length=36)
    subject: str = Field(min_length=5, max_length=160)
    message: str = Field(min_length=20, max_length=1000)
    image_url: str | None = Field(default=None, max_length=1000)
    expected_email_recipients: int = Field(ge=0)
    expected_telegram_recipients: int = Field(ge=0)
    confirm: Literal["SEND"]
    service_only: Literal[True]


def _telegram_token() -> str:
    return os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()


def _normalize_image(raw: str | None) -> str | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    parsed = urllib.parse.urlsplit(raw)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise HTTPException(422, "image_requires_public_https_url")
    if len(raw) > 1000:
        raise HTTPException(422, "image_url_too_long")
    return raw


def _authorized_scope(db: Session, account, scope: str, event_id: int | None, main):
    from demo_roles import ensure_manage, ensure_owner
    role = ensure_manage(db, account)
    if scope == "global":
        if role != "global_admin":
            raise HTTPException(403, "global_admin_required")
        if event_id is not None:
            raise HTTPException(422, "event_id_not_allowed_for_global")
        return None
    if not event_id:
        raise HTTPException(422, "event_id_required")
    ensure_owner(db, event_id, account)
    event = db.get(main.Event, event_id)
    if event is None:
        raise HTTPException(404, "event_not_found")
    if event.is_cancelled:
        raise HTTPException(409, "event_cancelled")
    return event


def _audience(db: Session, scope: str, event_id: int | None, main):
    from demo_accounts import WebAccount
    from demo_account_recovery import VerifiedEmail
    from demo_telegram import DemoTelegramIdentity

    query = db.query(WebAccount).join(VerifiedEmail, VerifiedEmail.account_id == WebAccount.id)
    if scope == "event":
        query = query.join(
            main.DemoTicket, main.DemoTicket.guest_id == WebAccount.guest_id
        ).filter(
            main.DemoTicket.event_id == event_id,
            main.DemoTicket.ticket_status == "active",
        ).distinct()
    # Email is sent only to the verified canonical website account address.
    email_accounts = [(row.id, row.guest_id, row.email) for row in query.order_by(WebAccount.id).all()]

    if scope == "global":
        bot_user_ids = db.query(main.User.telegram_id).filter(main.User.telegram_id > 0).all()
        miniapp_ids = db.query(DemoTelegramIdentity.telegram_id).filter(DemoTelegramIdentity.telegram_id > 0).all()
    else:
        # A historical Telegram registration may remain after a converted QR
        # ticket is cancelled; exclude these users from the event audience.
        bot_user_ids = db.query(main.User.telegram_id).join(
            main.Registration, main.Registration.user_id == main.User.id
        ).outerjoin(
            main.LegacyTicketClaim, main.LegacyTicketClaim.registration_id == main.Registration.id
        ).outerjoin(
            main.DemoTicket, main.DemoTicket.id == main.LegacyTicketClaim.ticket_id
        ).filter(
            main.Registration.event_id == event_id,
            or_(main.LegacyTicketClaim.registration_id.is_(None), main.DemoTicket.ticket_status == "active"),
        ).all()
        miniapp_ids = db.query(DemoTelegramIdentity.telegram_id).join(
            main.DemoTicket, main.DemoTicket.guest_id == DemoTelegramIdentity.guest_id
        ).filter(
            main.DemoTicket.event_id == event_id,
            main.DemoTicket.ticket_status == "active",
        ).all()
    ids = sorted({int(row[0]) for row in (bot_user_ids + miniapp_ids) if row[0] and int(row[0]) > 0})
    if len(email_accounts) > MAX_AUDIENCE_PER_CHANNEL or len(ids) > MAX_AUDIENCE_PER_CHANNEL:
        raise HTTPException(413, "audience_exceeds_50000_per_channel")
    return email_accounts, ids


def _summary(campaign: BroadcastCampaign, db: Session) -> dict:
    from demo_email import EmailOutbox
    emails = dict(db.query(EmailOutbox.state, func.count(EmailOutbox.id)).filter(
        EmailOutbox.kind == "broadcast_notice",
        EmailOutbox.notice_id == campaign.id,
    ).group_by(EmailOutbox.state).all())
    telegram = dict(db.query(BroadcastTelegramOutbox.state, func.count(BroadcastTelegramOutbox.id)).filter(
        BroadcastTelegramOutbox.campaign_id == campaign.id,
    ).group_by(BroadcastTelegramOutbox.state).all())
    return {
        "id": campaign.id,
        "scope": campaign.scope,
        "event_id": campaign.event_id,
        "subject": campaign.subject,
        "created_at": campaign.created_at,
        "email_count": campaign.email_count,
        "telegram_count": campaign.telegram_count,
        "emails": emails,
        "telegram": telegram,
    }


def install_broadcast_api(app, get_db, main):
    from demo_roles import account_lookup, role_for

    def authorized(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        return account_lookup(db, authorization)

    @app.post("/demo/manage/broadcasts/preview")
    def preview(payload: AudienceRequest, account=Depends(authorized), db: Session = Depends(get_db)):
        _authorized_scope(db, account, payload.scope, payload.event_id, main)
        emails, ids = _audience(db, payload.scope, payload.event_id, main)
        from demo_email import configured
        return {
            "scope": payload.scope,
            "event_id": payload.event_id,
            "email_recipients": len(emails),
            "telegram_recipients": len(ids),
            "email_available": configured(),
            "telegram_available": bool(_telegram_token()),
            "service_only": True,
            "role": role_for(db, account),
        }

    @app.get("/demo/manage/broadcasts")
    def history(account=Depends(authorized), db: Session = Depends(get_db)):
        from demo_roles import ensure_manage
        ensure_manage(db, account)
        query = db.query(BroadcastCampaign)
        if role_for(db, account) != "global_admin":
            from demo_roles import EventOwnership
            events = db.query(EventOwnership.event_id).filter(EventOwnership.owner_account_id == account.id)
            query = query.filter(BroadcastCampaign.scope == "event", BroadcastCampaign.event_id.in_(events))
        rows = query.order_by(BroadcastCampaign.id.desc()).limit(30).all()
        return [_summary(row, db) for row in rows]

    @app.post("/demo/manage/broadcasts", status_code=202)
    def send(payload: BroadcastSend, account=Depends(authorized), db: Session = Depends(get_db)):
        event = _authorized_scope(db, account, payload.scope, payload.event_id, main)
        from demo_email import EmailOutbox, configured
        from demo_roles import audit
        from demo_accounts import WebAccount
        from sqlalchemy import select

        if not configured() and not _telegram_token():
            raise HTTPException(503, "broadcast_providers_unavailable")
        if payload.image_url:
            image = _normalize_image(payload.image_url)
        else:
            image = None
        if not payload.subject.strip() or not payload.message.strip():
            raise HTTPException(422, "broadcast_content_required")
        if image and _telegram_token() and len(payload.subject.strip()) + len(payload.message.strip()) + 2 > 1024:
            raise HTTPException(422, "telegram_photo_caption_too_long")
        # Serializes confirmation by this actor to avoid duplicate broadcasts
        # from simultaneous taps in different browsers.
        db.execute(select(WebAccount).where(WebAccount.id == account.id).with_for_update()).scalar_one()
        previous = db.query(BroadcastCampaign).filter(BroadcastCampaign.request_id == payload.request_id).first()
        if previous is not None:
            if previous.actor_account_id != account.id:
                raise HTTPException(409, "request_id_already_used")
            return _summary(previous, db)
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        if payload.scope == "global":
            recent = db.query(BroadcastCampaign.id).filter(
                BroadcastCampaign.scope == "global",
                BroadcastCampaign.created_at >= since,
            ).count()
            if recent >= 1:
                raise HTTPException(429, "global_broadcast_limit_one_per_24h")
        else:
            recent = db.query(BroadcastCampaign.id).filter(
                BroadcastCampaign.scope == "event",
                BroadcastCampaign.event_id == payload.event_id,
                BroadcastCampaign.created_at >= since,
            ).count()
            if recent >= 2:
                raise HTTPException(429, "event_broadcast_limit_two_per_24h")

        email_accounts, telegram_ids = _audience(db, payload.scope, payload.event_id, main)
        if payload.expected_email_recipients != len(email_accounts) or payload.expected_telegram_recipients != len(telegram_ids):
            raise HTTPException(409, "broadcast_audience_changed_preview_again")
        if not email_accounts and not telegram_ids:
            raise HTTPException(409, "broadcast_audience_empty")

        now = datetime.now(timezone.utc)
        campaign = BroadcastCampaign(
            request_id=payload.request_id, actor_account_id=account.id,
            scope=payload.scope, event_id=payload.event_id,
            subject=payload.subject.strip(), message=payload.message.strip(), image_url=image,
            email_count=len(email_accounts) if configured() else 0,
            telegram_count=len(telegram_ids) if _telegram_token() else 0,
            created_at=now,
        )
        db.add(campaign)
        db.flush()

        if configured():
            rows = [{
                "event_key": "broadcast:%s:account:%s" % (campaign.id, account_id),
                "kind": "broadcast_notice", "recipient": email, "guest_id": guest_id,
                "notice_id": campaign.id, "state": "pending", "attempts": 0,
                "next_attempt_at": now, "created_at": now, "language": "en",
            } for account_id, guest_id, email in email_accounts]
            for offset in range(0, len(rows), 500):
                db.execute(pg_insert(EmailOutbox.__table__).values(rows[offset:offset + 500]).
                           on_conflict_do_nothing(index_elements=["event_key"]))
        if _telegram_token():
            rows = [{
                "campaign_id": campaign.id, "telegram_id": telegram_id,
                "state": "pending", "attempts": 0, "next_attempt_at": now,
            } for telegram_id in telegram_ids]
            for offset in range(0, len(rows), 500):
                db.execute(pg_insert(BroadcastTelegramOutbox.__table__).values(rows[offset:offset + 500]))
        if event is not None:
            audit(db, event.id, account.id, "broadcast", "campaign:%s;email:%s;telegram:%s" % (
                campaign.id, campaign.email_count, campaign.telegram_count
            ))
        db.commit()
        return _summary(campaign, db)


def render_broadcast_email(row, db: Session) -> dict | None:
    campaign = db.get(BroadcastCampaign, row.notice_id)
    if not campaign or campaign.id <= 0:
        return None
    from demo_accounts import WebAccount
    from demo_account_recovery import VerifiedEmail
    # Re-check email ownership before actual send (user may delete the account).
    account = db.query(WebAccount).join(VerifiedEmail, VerifiedEmail.account_id == WebAccount.id).filter(
        WebAccount.guest_id == row.guest_id,
        WebAccount.email == row.recipient,
    ).first()
    if not account:
        return None
    from demo_email import email_shell
    web_url = (os.getenv("WEB_APP_URL", "").strip() or "https://tickettreat.eu").rstrip("/")
    title = "Information from TicketTreat"
    link = web_url
    button = "Open TicketTreat"
    if campaign.scope == "event" and campaign.event_id:
        title = "Event update from the organizer"
        link = "%s/events/%s" % (web_url, campaign.event_id)
        button = "Open event"
    extra = ""
    if campaign.image_url:
        extra = '<p style="margin:12px 0"><img src="%s" alt="Event update" style="max-width:100%%;height:auto"></p>' % (
            html.escape(campaign.image_url, quote=True),
        )
    content = email_shell(
        campaign.subject, campaign.message, extra, link, button,
        "Service information about your TicketTreat account or an event you joined.",
        "TicketTreat service announcement. For support, contact @vvladver on Telegram.",
    )
    return {"from": os.environ["EMAIL_FROM"].strip(), "to": [row.recipient],
            "subject": campaign.subject, "html": content,
            "text": "%s\n\n%s\n\n%s" % (campaign.subject, campaign.message, link)}


def _send_telegram(campaign: BroadcastCampaign, telegram_id: int) -> None:
    token = _telegram_token()
    if not token:
        raise RuntimeError("telegram_not_configured")
    message = "%s\n\n%s" % (campaign.subject, campaign.message)
    body = {"chat_id": telegram_id}
    if campaign.image_url:
        body["photo"] = campaign.image_url
        body["caption"] = message[:1024]
        endpoint = "sendPhoto"
    else:
        body["text"] = message
        endpoint = "sendMessage"
    req = urllib.request.Request(
        "https://api.telegram.org/bot%s/%s" % (token, endpoint),
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=18) as response:
            result = json.loads(response.read().decode("utf-8"))
            if not result.get("ok"):
                raise RuntimeError("telegram_rejected_request")
    except urllib.error.HTTPError as error:
        # Never expose token or chat id via returned errors/log messages.
        if error.code in (400, 403):
            raise ValueError("telegram_chat_unavailable")
        raise RuntimeError("telegram_http_%s" % error.code)
    except urllib.error.URLError:
        raise RuntimeError("telegram_network_unavailable")


def _deliver_telegram(db: Session) -> bool:
    now = datetime.now(timezone.utc)
    item = db.query(BroadcastTelegramOutbox).filter(
        BroadcastTelegramOutbox.state == "pending",
        BroadcastTelegramOutbox.attempts < 5,
        BroadcastTelegramOutbox.next_attempt_at <= now,
    ).order_by(BroadcastTelegramOutbox.id).with_for_update(skip_locked=True).first()
    if item is None:
        return False
    item.attempts += 1
    try:
        campaign = db.get(BroadcastCampaign, item.campaign_id)
        if campaign is None:
            item.state = "skipped"
        else:
            _send_telegram(campaign, int(item.telegram_id))
            item.state = "sent"
            item.sent_at = datetime.now(timezone.utc)
            item.last_error = None
    except ValueError:
        item.state = "skipped"
        item.last_error = "chat_unavailable"
    except Exception as exc:
        item.last_error = str(exc)[:200]
        if item.attempts >= 5:
            item.state = "failed"
        else:
            item.next_attempt_at = now + timedelta(seconds=min(3600, 30 * (2 ** item.attempts)))
    db.commit()
    return True


_started = False
_start_lock = threading.Lock()


def install_broadcast_worker(app, session_factory) -> None:
    @app.on_event("startup")
    def start_broadcast_worker():
        global _started
        if not _telegram_token() or os.getenv("DEMO_ISOLATED_API", "false").lower() != "true":
            return
        with _start_lock:
            if _started:
                return
            _started = True

        def run():
            LOG.info("TicketTreat Telegram broadcast worker started")
            while True:
                try:
                    for _ in range(10):
                        with session_factory() as db:
                            if not _deliver_telegram(db):
                                break
                except Exception:
                    LOG.exception("Telegram broadcast worker error")
                time.sleep(1)

        threading.Thread(target=run, name="tickettreat-broadcast", daemon=True).start()
