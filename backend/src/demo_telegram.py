"""Verified Telegram Mini App identity bridge for TicketTreat.

Security model:
- Trust only Telegram-signed initData, never initDataUnsafe or caller-supplied IDs.
- Do not merge a Telegram identity with an email account based on names/emails.
- Preserve legacy bot registrations; do not reissue or invent QR tickets for them.
- Operates only on the isolated Demo API with a server-side bot token.
"""
from __future__ import annotations

import hashlib
import html
import urllib.error
import urllib.request
import hmac
import json
import logging
import os
import secrets
import time
from urllib.parse import parse_qsl
from typing import Any
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, Column, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base

LOGGER = logging.getLogger("tickettreat.telegram_auth")
INIT_DATA_MAX_AGE_SECONDS = 24 * 3600
INIT_DATA_CLOCK_SKEW_SECONDS = 60


class DemoTelegramIdentity(Base):
    __tablename__ = "demo_telegram_identities"
    telegram_id = Column(BigInteger, primary_key=True)
    guest_id = Column(Integer, nullable=False, unique=True)


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(min_length=32, max_length=8192)


def verified_telegram_user(init_data: str, bot_token: str, now: int | None = None) -> dict[str, Any]:
    """Validate WebApp.initData according to Telegram HMAC-SHA256 rules."""
    if not bot_token:
        raise HTTPException(status_code=503, detail="telegram_auth_not_configured")

    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True, max_num_fields=40)
        parsed = dict(pairs)
        if len(parsed) != len(pairs):
            raise ValueError("duplicate_parameter")
        received_hash = parsed.pop("hash", "")
        if len(received_hash) != 64:
            raise ValueError("invalid_hash")
        int(received_hash, 16)
        data_check = "\n".join(f"{key}={value}" for key, value in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
        expected = hmac.new(secret_key, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(received_hash.lower(), expected):
            raise ValueError("signature_mismatch")

        timestamp = int(parsed["auth_date"])
        current = int(time.time()) if now is None else now
        if timestamp > current + INIT_DATA_CLOCK_SKEW_SECONDS or current - timestamp > INIT_DATA_MAX_AGE_SECONDS:
            raise ValueError("init_data_expired")

        user = json.loads(parsed["user"])
        if not isinstance(user, dict) or type(user.get("id")) is not int:
            raise ValueError("invalid_user")
        if not 0 < user["id"] < 2**63:
            raise ValueError("invalid_telegram_id")
        if not isinstance(user.get("first_name"), str) or not user["first_name"].strip():
            raise ValueError("invalid_first_name")
        return user
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, UnicodeError):
        raise HTTPException(status_code=401, detail="invalid_telegram_init_data") from None


def bot_user_registrations(db: Session, telegram_id: int, main) -> list[dict]:
    """Old reservations stay visible until securely converted into QR tickets."""
    from demo_legacy import unresolved_bot_registrations
    return unresolved_bot_registrations(db,telegram_id,main)



class TelegramLinkChallenge(Base):
    """Short-lived, one-use proof of a logged-in website account."""
    __tablename__ = "demo_telegram_link_challenges"
    id = Column(Integer, primary_key=True)
    code_hash = Column(String(64), nullable=False, unique=True, index=True)
    account_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    telegram_id = Column(BigInteger, nullable=True)


class TelegramLinkClaim(BaseModel):
    challenge: str = Field(min_length=24, max_length=100)
    init_data: str = Field(min_length=32, max_length=8192)


def _link_hash(challenge: str) -> str:
    return hashlib.sha256(challenge.encode("utf-8")).hexdigest()


def _telegram_link(db: Session, main, account, user: dict, background_tasks: BackgroundTasks,
                   challenge: TelegramLinkChallenge | None = None) -> dict:
    """Merge only after website auth and Telegram's signed launch data were verified.

    Never move a ticket across an event/guest unique constraint. Unambiguous
    duplicate *free* passes are cancelled in place so their history remains
    inspectable; money/checked-in collisions require manual reconciliation.
    """
    from demo_accounts import WebAccount
    from demo_legacy import reconcile_free_legacy
    from demo_paid_reservations import PaidReservation

    telegram_id = user["id"]
    link = db.query(DemoTelegramIdentity).filter(
        DemoTelegramIdentity.telegram_id == telegram_id
    ).with_for_update().first()
    if link is None:
        # Telegram may have used the legacy bot without ever opening Mini App.
        old = main.DemoGuest(
            access_token=secrets.token_urlsafe(32), telegram_id=telegram_id,
            username=str(user.get("username") or "")[:255] or None,
            first_name=user["first_name"].strip()[:100],
            last_name=str(user.get("last_name") or "")[:100] or None,
        )
        db.add(old)
        db.flush()
        link = DemoTelegramIdentity(telegram_id=telegram_id, guest_id=old.id)
        db.add(link)
        db.flush()
    else:
        old = db.query(main.DemoGuest).filter(
            main.DemoGuest.id == link.guest_id
        ).with_for_update().first()

    existing_web = db.query(WebAccount).filter(WebAccount.guest_id == link.guest_id).first()
    if existing_web and existing_web.id != account.id:
        raise HTTPException(409, "telegram_already_linked_to_another_account")
    other_telegram = db.query(DemoTelegramIdentity).filter(
        DemoTelegramIdentity.guest_id == account.guest_id,
        DemoTelegramIdentity.telegram_id != telegram_id,
    ).first()
    if other_telegram:
        raise HTTPException(409, "website_account_has_another_telegram")

    if link.guest_id == account.guest_id:
        if challenge is not None:
            challenge.status, challenge.telegram_id = "linked", telegram_id
            db.commit()
        return {"linked": True, "already_linked": True, "migrated_tickets": 0}

    guest = db.query(main.DemoGuest).filter(
        main.DemoGuest.id == account.guest_id
    ).with_for_update().first()
    if old is None or guest is None:
        raise HTTPException(409, "identity_guest_missing")

    web_tickets = {
        row.event_id: row for row in db.query(main.DemoTicket).filter(
            main.DemoTicket.guest_id == guest.id
        ).all()
    }
    old_tickets = db.query(main.DemoTicket).filter(
        main.DemoTicket.guest_id == old.id
    ).all()
    web_waitlists = {
        row.event_id: row for row in db.query(main.DemoWaitlist).filter(
            main.DemoWaitlist.guest_id == guest.id
        ).all()
    }
    old_waitlists = db.query(main.DemoWaitlist).filter(
        main.DemoWaitlist.guest_id == old.id
    ).all()
    existing_reservations = {
        row.event_id: row for row in db.query(PaidReservation).filter(
            PaidReservation.guest_id == guest.id
        ).all()
    }
    old_reservations = db.query(PaidReservation).filter(
        PaidReservation.guest_id == old.id
    ).all()

    # Preflight before mutating anything. Never auto-merge paid, checked-in or
    # operationally complex duplicates (offers/holds).
    free_sources = {"free", "legacy_free"}
    duplicates = []
    for ticket in old_tickets:
        current = web_tickets.get(ticket.event_id)
        if current is not None:
            if not (
                ticket.payment_provider in free_sources
                and current.payment_provider in free_sources
                and ticket.checked_in_at is None
                and current.checked_in_at is None
                and ticket.ticket_status == "active"
                and current.ticket_status == "active"
            ):
                raise HTTPException(409, "duplicate_event_ticket_requires_manual_resolution")
            duplicates.append(ticket)

    for row in old_waitlists:
        current = web_waitlists.get(row.event_id)
        if current is not None and not (
            row.status == "waiting" and current.status == "waiting"
        ):
            raise HTTPException(409, "duplicate_waitlist_requires_manual_resolution")
    if any(row.event_id in existing_reservations for row in old_reservations):
        raise HTTPException(409, "duplicate_paid_reservation_requires_manual_resolution")

    duplicate_ids = {row.id for row in duplicates}
    for row in old_tickets:
        if row.id in duplicate_ids:
            row.ticket_status = "cancelled"
            row.cancelled_at = datetime.now(timezone.utc)
        else:
            row.guest_id = guest.id
    for row in old_waitlists:
        if row.event_id in web_waitlists:
            row.status = "cancelled"  # Preserve the old queue record for audit.
        else:
            row.guest_id = guest.id
    for row in old_reservations:
        row.guest_id = guest.id

    # Rotate the abandoned Telegram guest bearer token.
    old.access_token = secrets.token_urlsafe(32)
    old.telegram_id = None
    guest.telegram_id = telegram_id
    guest.username = str(user.get("username") or "")[:255] or None
    link.guest_id = guest.id
    if challenge is not None:
        challenge.status, challenge.telegram_id = "linked", telegram_id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "telegram_link_conflict") from None
    legacy = reconcile_free_legacy(db, main, telegram_id, guest.id)
    notified = 0
    for ticket in web_tickets.values():
        if notified >= 5:
            break
        if ticket.ticket_status != "active":
            continue
        event = db.get(main.Event, ticket.event_id)
        if event is None or event.is_cancelled or main.event_has_started(event):
            continue
        background_tasks.add_task(
            send_miniapp_ticket_notice, telegram_id, event.title, ticket.id,
            ticket.payment_provider in free_sources, "ru",
        )
        notified += 1
    return {
        "linked": True, "already_linked": False,
        "migrated_tickets": len(old_tickets) - len(duplicate_ids) + legacy["converted"],
        "deduplicated_free_tickets": len(duplicate_ids),
        "migrated_waitlists": sum(x.event_id not in web_waitlists for x in old_waitlists),
        "migrated_paid_reservations": len(old_reservations),
        "legacy_unresolved": legacy["held_for_review"],
    }


def install_telegram_auth(app, get_db, main) -> None:
    @app.post("/demo/telegram/link")
    def link_telegram(payload: TelegramAuthRequest, background_tasks: BackgroundTasks,
                      authorization: str | None = Header(None),
                      db: Session = Depends(get_db)):
        from demo_roles import account_lookup
        from demo_account_recovery import email_is_verified
        if not main.DEMO_ISOLATED_API:
            raise HTTPException(503, "telegram_miniapp_requires_isolated_api")
        account = account_lookup(db, authorization)
        if not email_is_verified(db, account.id):
            raise HTTPException(403, "email_verification_required")
        user = verified_telegram_user(
            payload.init_data, os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
        )
        return _telegram_link(db, main, account, user, background_tasks)

    @app.post("/demo/telegram/link/start")
    def start_link(authorization: str | None = Header(None), db: Session = Depends(get_db)):
        from demo_roles import account_lookup
        from demo_account_recovery import email_is_verified
        if not main.DEMO_ISOLATED_API:
            raise HTTPException(503, "telegram_miniapp_requires_isolated_api")
        account = account_lookup(db, authorization)
        if not email_is_verified(db, account.id):
            raise HTTPException(403, "email_verification_required")
        # Revoke previous pending challenges from this site account.
        db.query(TelegramLinkChallenge).filter(
            TelegramLinkChallenge.account_id == account.id,
            TelegramLinkChallenge.status == "pending",
        ).update({"status": "expired"}, synchronize_session=False)
        code = secrets.token_urlsafe(24)
        now = datetime.now(timezone.utc)
        db.add(TelegramLinkChallenge(
            code_hash=_link_hash(code), account_id=account.id,
            created_at=now, expires_at=now + timedelta(minutes=10),
            status="pending",
        ))
        db.commit()
        return {
            "challenge": code, "expires_in_seconds": 600,
            "bot_link": f"https://t.me/TicketTreatBot?start=link_{code}",
        }

    @app.get("/demo/telegram/link/status")
    def link_status(challenge: str, authorization: str | None = Header(None),
                    db: Session = Depends(get_db)):
        from demo_roles import account_lookup
        account = account_lookup(db, authorization)
        if len(challenge) < 24 or len(challenge) > 100:
            raise HTTPException(404, "link_not_found")
        row = db.query(TelegramLinkChallenge).filter(
            TelegramLinkChallenge.code_hash == _link_hash(challenge),
            TelegramLinkChallenge.account_id == account.id,
        ).first()
        if row is None:
            raise HTTPException(404, "link_not_found")
        expired = row.status == "pending" and row.expires_at.replace(
            tzinfo=timezone.utc
        ) <= datetime.now(timezone.utc) if row.expires_at.tzinfo is None else (
            row.status == "pending" and row.expires_at <= datetime.now(timezone.utc)
        )
        return {"status": "expired" if expired else row.status,
                "linked": row.status == "linked"}

    @app.post("/demo/telegram/link/claim")
    def claim_link(payload: TelegramLinkClaim, background_tasks: BackgroundTasks,
                   db: Session = Depends(get_db)):
        from demo_accounts import WebAccount
        from demo_account_recovery import email_is_verified
        if not main.DEMO_ISOLATED_API:
            raise HTTPException(503, "telegram_miniapp_requires_isolated_api")
        user = verified_telegram_user(
            payload.init_data, os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
        )
        row = db.query(TelegramLinkChallenge).filter(
            TelegramLinkChallenge.code_hash == _link_hash(payload.challenge),
        ).with_for_update().first()
        if row is None:
            raise HTTPException(404, "link_not_found")
        if row.status != "pending":
            raise HTTPException(409, "link_already_used_or_revoked")
        expiry = row.expires_at
        if (expiry.replace(tzinfo=timezone.utc) if expiry.tzinfo is None else expiry) <= datetime.now(timezone.utc):
            raise HTTPException(410, "link_expired")
        account = db.query(WebAccount).filter(WebAccount.id == row.account_id).first()
        if account is None or not email_is_verified(db, account.id):
            raise HTTPException(403, "email_verification_required")
        return _telegram_link(db, main, account, user, background_tasks, challenge=row)

    @app.post("/demo/telegram/auth")
    def telegram_auth(payload: TelegramAuthRequest, db: Session = Depends(get_db)):
        token = os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
        if not main.DEMO_ISOLATED_API:
            raise HTTPException(status_code=503, detail="telegram_miniapp_requires_isolated_api")
        user = verified_telegram_user(payload.init_data, token)
        telegram_id = user["id"]
        link = db.query(DemoTelegramIdentity).filter(DemoTelegramIdentity.telegram_id == telegram_id).first()
        if link is None:
            # No trust in legacy DemoGuest.telegram_id: only signed identity creates mapping.
            guest = main.DemoGuest(
                access_token=secrets.token_urlsafe(32),
                telegram_id=telegram_id,
                username=str(user.get("username") or "")[:255] or None,
                first_name=user["first_name"].strip()[:100],
                last_name=str(user.get("last_name") or "")[:100] or None,
                email=None,
            )
            try:
                db.add(guest)
                db.flush()
                db.add(DemoTelegramIdentity(telegram_id=telegram_id, guest_id=guest.id))
                db.commit()
                db.refresh(guest)
            except IntegrityError:
                # Concurrent Mini App tabs can authenticate the same Telegram ID.
                db.rollback()
                link = db.query(DemoTelegramIdentity).filter(DemoTelegramIdentity.telegram_id == telegram_id).first()
                if link is None:
                    raise HTTPException(status_code=503, detail="telegram_login_retry")
                guest = db.query(main.DemoGuest).filter(main.DemoGuest.id == link.guest_id).first()
                if guest is None:
                    raise HTTPException(status_code=503, detail="telegram_identity_incomplete")
        else:
            guest = db.query(main.DemoGuest).filter(main.DemoGuest.id == link.guest_id).first()
            if guest is None:
                raise HTTPException(status_code=503, detail="telegram_identity_incomplete")
            # Keep Telegram display name current, never touch user's web account/email.
            guest.username = str(user.get("username") or "")[:255] or None
            # A linked website account owns its canonical profile name.
            from demo_accounts import WebAccount
            if not db.query(WebAccount.id).filter(WebAccount.guest_id == guest.id).first():
                guest.first_name = user["first_name"].strip()[:100]
                guest.last_name = str(user.get("last_name") or "")[:100] or None
            db.commit()
            db.refresh(guest)

        from demo_legacy import reconcile_free_legacy
        legacy = reconcile_free_legacy(db,main,telegram_id,guest.id)
        return {
            "legacy_reconciliation": legacy,
            "guest": main.demo_guest_to_dict(guest, db),
            "telegram": {
                "id": telegram_id,
                "first_name": guest.first_name,
                "username": guest.username,
            },
            "bot_registrations": bot_user_registrations(db, telegram_id, main),
            "accounts_linked": bool(db.query(__import__("demo_accounts").WebAccount.id).filter(__import__("demo_accounts").WebAccount.guest_id == guest.id).first()),
        }

def send_miniapp_ticket_notice(
    telegram_id: int, event_title: str, ticket_id: int, is_free: bool, language: str = "en",
) -> None:
    """Best-effort private Telegram confirmation; does not block checkout.

    A Telegram bot cannot initiate a DM to a user who never started it.
    Do not send raw bearer/QR tokens in messages or logs.
    """
    bot_token = os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
    web_url = os.getenv("WEB_APP_URL", "").strip().rstrip("/")
    if not bot_token or not web_url.startswith("https://"):
        return

    copy = {
        "ru": ("Бесплатный билет" if is_free else "Билет — оплата подтверждена организатором",
               "оформлен", "Билет №", "Открой Mini App, чтобы показать QR-код на входе.", "Открыть QR-билет"),
        "uk": ("Безкоштовний квиток" if is_free else "Квиток — оплату підтверджено організатором",
               "готовий", "Квиток №", "Відкрий Mini App, щоб показати QR-код на вході.", "Відкрити QR-квиток"),
        "cs": ("Vstupenka zdarma" if is_free else "Vstupenka — platba potvrzena pořadatelem",
               "vystavena", "Vstupenka č.", "Otevři Mini App a u vstupu ukaž QR kód.", "Otevřít QR vstupenku"),
        "en": ("Free ticket" if is_free else "Ticket — organizer confirmed payment",
               "confirmed", "Ticket #", "Open Mini App to show your QR code at the entrance.", "Open QR ticket"),
    }
    locale = (language or "en").lower().split("-", 1)[0]
    heading, status, number, hint, button = copy.get(locale, copy["en"])
    event = html.escape(event_title[:180])
    ticket_url = f"{web_url}/tickets/{ticket_id}"
    payload = {
        "chat_id": telegram_id,
        "text": (
            f"<b>🎟 {heading} — {status}</b>\\n"
            f"<b>{event}</b>\\n"
            f"{number} CRD-{ticket_id:06d}\\n"
            f"{hint}"
        ).replace("\\n", "\n"),
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[{
                "text": f"🎫 {button}",
                "web_app": {"url": ticket_url},
            }]]
        },
    }
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            if response.status != 200:
                LOGGER.warning("Telegram notice failed with non-200 response (ticket %s)", ticket_id)
    except urllib.error.HTTPError as exc:
        # 403 is normal when the user has blocked the bot.
        LOGGER.warning("Telegram notice HTTP %s for ticket %s", exc.code, ticket_id)
    except (urllib.error.URLError, TimeoutError):
        LOGGER.warning("Telegram notice unavailable for ticket %s", ticket_id)


def verified_telegram_id_for_guest(db: Session, guest_id: int) -> int | None:
    # Do not trust demo_guests.telegram_id alone, since guests can be created
    # anonymously; only the signed-identity mapping is sufficient evidence.
    row = db.query(DemoTelegramIdentity).filter(DemoTelegramIdentity.guest_id == guest_id).first()
    return int(row.telegram_id) if row is not None else None
