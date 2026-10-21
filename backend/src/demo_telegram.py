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

from fastapi import Depends, HTTPException
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
    """Only expose bot reservations after Telegram verified this exact user ID."""
    return main.get_user_events(telegram_id, include_past=True, db=db)


def install_telegram_auth(app, get_db, main) -> None:
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
            guest.first_name = user["first_name"].strip()[:100]
            guest.last_name = str(user.get("last_name") or "")[:100] or None
            db.commit()
            db.refresh(guest)

        return {
            "guest": main.demo_guest_to_dict(guest, db),
            "telegram": {
                "id": telegram_id,
                "first_name": guest.first_name,
                "username": guest.username,
            },
            "bot_registrations": bot_user_registrations(db, telegram_id, main),
            "accounts_linked": False,
        }

def send_miniapp_ticket_notice(telegram_id: int, event_title: str, ticket_id: int, is_free: bool) -> None:
    """Best-effort private Telegram confirmation; does not block checkout.

    A Telegram bot cannot initiate a DM to a user who never started it.
    Do not send raw bearer/QR tokens in messages or logs.
    """
    bot_token = os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
    web_url = os.getenv("WEB_APP_URL", "").strip().rstrip("/")
    if not bot_token or not web_url.startswith("https://"):
        return

    kind = "🎟 Бесплатный билет" if is_free else "🎟 Crowdly Demo билет"
    event = html.escape(event_title[:180])
    ticket_url = f"{web_url}/tickets/{ticket_id}"
    payload = {
        "chat_id": telegram_id,
        "text": (
            f"<b>{kind} оформлен!</b>\\n"
            f"<b>{event}</b>\\n"
            f"Билет № CRD-{ticket_id:06d}\\n"
            "Открой Mini App, чтобы показать QR-код на входе."
        ).replace("\\n", "\n"),
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {
            "inline_keyboard": [[{
                "text": "🎫 Открыть QR-билет",
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
