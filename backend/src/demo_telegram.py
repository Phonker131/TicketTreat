"""Verified Telegram Mini App identity bridge for Crowdly.

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

from fastapi import Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, Column, Integer, UniqueConstraint
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base

LOGGER = logging.getLogger("crowdly.telegram_auth")
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


def install_telegram_auth(app, get_db, main) -> None:
    @app.post("/demo/telegram/link")
    def link_telegram(payload: TelegramAuthRequest, authorization: str | None = Header(None),
                      db: Session = Depends(get_db)):
        """Explicitly link separately authenticated website and Telegram identities.

        Preserve all existing QR passes and waitlist records. Do not guess from
        name/email. Reject conflicts instead of silently overwriting bookings.
        """
        from demo_roles import account_lookup
        from demo_accounts import WebAccount
        from demo_account_recovery import email_is_verified
        if not main.DEMO_ISOLATED_API:
            raise HTTPException(503, "telegram_miniapp_requires_isolated_api")
        account = account_lookup(db, authorization)
        if not email_is_verified(db, account.id):
            raise HTTPException(403, "email_verification_required")
        user = verified_telegram_user(payload.init_data, os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip())
        telegram_id = user["id"]
        link = db.query(DemoTelegramIdentity).filter(
            DemoTelegramIdentity.telegram_id == telegram_id
        ).with_for_update().first()
        if link is None:
            # The Telegram account must first have been signed in via Mini App.
            raise HTTPException(409, "telegram_login_required_first")
        existing_web = db.query(WebAccount).filter(WebAccount.guest_id == link.guest_id).first()
        if existing_web and existing_web.id != account.id:
            raise HTTPException(409, "telegram_already_linked_to_another_account")
        any_other = db.query(DemoTelegramIdentity).filter(
            DemoTelegramIdentity.guest_id == account.guest_id,
            DemoTelegramIdentity.telegram_id != telegram_id,
        ).first()
        if any_other:
            raise HTTPException(409, "website_account_has_another_telegram")
        if link.guest_id == account.guest_id:
            return {"linked": True, "already_linked": True}
        old = db.query(main.DemoGuest).filter(main.DemoGuest.id == link.guest_id).with_for_update().first()
        guest = db.query(main.DemoGuest).filter(main.DemoGuest.id == account.guest_id).with_for_update().first()
        if old is None or guest is None:
            raise HTTPException(409, "identity_guest_missing")
        web_tickets = {row.event_id for row in db.query(main.DemoTicket).filter(
            main.DemoTicket.guest_id == guest.id).all()}
        tg_tickets = db.query(main.DemoTicket).filter(main.DemoTicket.guest_id == old.id).all()
        if any(t.event_id in web_tickets for t in tg_tickets):
            raise HTTPException(409, "duplicate_event_ticket_requires_manual_resolution")
        web_waitlists = {row.event_id for row in db.query(main.DemoWaitlist).filter(
            main.DemoWaitlist.guest_id == guest.id).all()}
        tg_waitlists = db.query(main.DemoWaitlist).filter(main.DemoWaitlist.guest_id == old.id).all()
        if any(w.event_id in web_waitlists for w in tg_waitlists):
            raise HTTPException(409, "duplicate_waitlist_requires_manual_resolution")
        for row in tg_tickets:
            row.guest_id = guest.id
        for row in tg_waitlists:
            row.guest_id = guest.id
        # Invalidate the former Telegram-only guest bearer credential.
        old.access_token = secrets.token_urlsafe(32)
        old.telegram_id = None
        guest.telegram_id = telegram_id
        guest.username = str(user.get("username") or "")[:255] or None
        link.guest_id = guest.id
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "telegram_link_conflict") from None
        from demo_legacy import reconcile_free_legacy
        legacy = reconcile_free_legacy(db,main,telegram_id,guest.id)
        return {"linked": True, "already_linked": False,
                "migrated_tickets": len(tg_tickets)+legacy["converted"],
                "migrated_waitlists": len(tg_waitlists),
                "legacy_unresolved": legacy["held_for_review"]}

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
        "ru": ("Бесплатный билет" if is_free else "Демо-билет",
               "оформлен", "Билет №", "Открой Mini App, чтобы показать QR-код на входе.", "Открыть QR-билет"),
        "uk": ("Безкоштовний квиток" if is_free else "Демо-квиток",
               "готовий", "Квиток №", "Відкрий Mini App, щоб показати QR-код на вході.", "Відкрити QR-квиток"),
        "cs": ("Vstupenka zdarma" if is_free else "Demo vstupenka",
               "vystavena", "Vstupenka č.", "Otevři Mini App a u vstupu ukaž QR kód.", "Otevřít QR vstupenku"),
        "en": ("Free ticket" if is_free else "Demo ticket",
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
