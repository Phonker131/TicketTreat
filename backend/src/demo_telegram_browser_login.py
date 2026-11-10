"""Browser login approved from @TicketTreatBot without exposing web credentials.

The browser owns an HttpOnly verifier that never appears in the bot link.
The Mini App approves only with Telegram-signed initData. Completion creates
the ordinary scoped website session exactly once. No login by name/email.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, Column, DateTime, Integer, String
from sqlalchemy.orm import Session

from db.base import Base

TTL_SECONDS = 600


class TelegramBrowserLogin(Base):
    __tablename__ = "demo_telegram_browser_logins"
    code_hash = Column(String(64), primary_key=True)
    verifier_hash = Column(String(64), nullable=False)
    pin_hash = Column(String(64), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    telegram_id = Column(BigInteger, nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    username = Column(String(255), nullable=True)
    status = Column(String(16), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)


class BotBrowserApproval(BaseModel):
    challenge: str = Field(min_length=30, max_length=100)
    init_data: str = Field(min_length=32, max_length=8192)
    pin: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class BotBrowserComplete(BaseModel):
    challenge: str = Field(min_length=30, max_length=100)


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _pin_hash(challenge: str, pin: str) -> str:
    # A database leak cannot brute-force six-digit PINs without the bot key.
    key=os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN","").encode()
    return hmac.new(key,("browser-login-pin:"+challenge+":"+pin).encode(),hashlib.sha256).hexdigest()


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def bot_ready() -> bool:
    token = os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN", "").strip()
    return len(token) >= 20


def install_browser_telegram_login(app, get_db, DemoGuest, issue_session, profile_dict):
    @app.get("/demo/auth/telegram/browser/status")
    def readiness():
        return {"enabled":bot_ready()}

    @app.post("/demo/auth/telegram/browser/start")
    def start(request:Request,db:Session=Depends(get_db)):
        if not bot_ready():
            raise HTTPException(503,"telegram_login_not_configured")
        from demo_auth_security import guard_rate,record_rate
        ip=request.client.host if request.client else "unknown"
        guard_rate(db,"telegram_browser_login_ip",ip,15,600)
        record_rate(db,"telegram_browser_login_ip",ip,600)
        challenge=secrets.token_urlsafe(32)
        verifier=secrets.token_urlsafe(32)
        pin=f"{secrets.randbelow(1_000_000):06d}"
        db.query(TelegramBrowserLogin).filter(
            TelegramBrowserLogin.expires_at < datetime.now(timezone.utc)).delete(synchronize_session=False)
        db.add(TelegramBrowserLogin(
            code_hash=_hash(challenge),verifier_hash=_hash(verifier),
            pin_hash=_pin_hash(challenge,pin),attempts=0,
            status="pending",expires_at=datetime.now(timezone.utc)+timedelta(seconds=TTL_SECONDS)))
        db.commit()
        return {
            "challenge":challenge,"browser_token":verifier,"pin":pin,
            "bot_link":f"https://t.me/TicketTreatBot?start=login_{challenge}",
            "expires_in_seconds":TTL_SECONDS,
        }

    @app.post("/demo/auth/telegram/browser/claim")
    def approve(payload:BotBrowserApproval,db:Session=Depends(get_db)):
        if not bot_ready():
            raise HTTPException(503,"telegram_login_not_configured")
        from demo_telegram import verified_telegram_user
        user=verified_telegram_user(payload.init_data,os.getenv("TELEGRAM_MINIAPP_BOT_TOKEN","").strip())
        row=db.query(TelegramBrowserLogin).filter(
            TelegramBrowserLogin.code_hash == _hash(payload.challenge)).with_for_update().first()
        if row is None:
            raise HTTPException(404,"telegram_login_not_found")
        if _aware(row.expires_at) <= datetime.now(timezone.utc):
            raise HTTPException(410,"telegram_login_expired")
        if row.status != "pending":
            raise HTTPException(409,"telegram_login_already_approved")
        if row.attempts >= 5:
            raise HTTPException(429,"telegram_login_attempts_exceeded")
        row.attempts+=1
        if not secrets.compare_digest(row.pin_hash,_pin_hash(payload.challenge,payload.pin)):
            db.commit()
            raise HTTPException(400,"telegram_login_pin_invalid")
        row.telegram_id=user["id"]
        row.first_name=user["first_name"].strip()[:100]
        row.last_name=str(user.get("last_name") or "")[:100]
        row.username=str(user.get("username") or "")[:255]
        row.status="claimed"
        db.commit()
        return {"status":"approved"}

    @app.post("/demo/auth/telegram/browser/complete")
    def complete(payload:BotBrowserComplete,
                 x_telegram_browser_token:str|None=Header(default=None),
                 db:Session=Depends(get_db)):
        # The gateway forwards this secret exclusively from its HttpOnly
        # SameSite browser cookie. A public Telegram link has no such proof.
        if not x_telegram_browser_token or not 30 <= len(x_telegram_browser_token) <= 128:
            raise HTTPException(401,"telegram_browser_proof_required")
        row=db.query(TelegramBrowserLogin).filter(
            TelegramBrowserLogin.code_hash==_hash(payload.challenge)).with_for_update().first()
        if row is None:
            raise HTTPException(404,"telegram_login_not_found")
        if not secrets.compare_digest(row.verifier_hash,_hash(x_telegram_browser_token)):
            raise HTTPException(401,"telegram_browser_proof_required")
        if _aware(row.expires_at) <= datetime.now(timezone.utc):
            raise HTTPException(410,"telegram_login_expired")
        if row.status=="pending":
            return {"status":"pending"}  # Gateway handles without saving a cookie.
        if row.status!="claimed" or row.telegram_id is None:
            raise HTTPException(409,"telegram_login_already_used")
        # No raw browser bearer token is stored in PostgreSQL. The browser
        # secret and Telegram-signed approval have independent provenance.
        row.status="consumed"
        from demo_telegram_oidc import ensure_telegram_web_account
        claims={
            "id":int(row.telegram_id),"sub":str(row.telegram_id),"given_name":row.first_name or "Telegram user",
            "family_name":row.last_name or "","preferred_username":row.username or "",
        }
        account=ensure_telegram_web_account(db,DemoGuest,claims)
        token=issue_session(db,account)
        return {"status":"authenticated","token":token,"profile":profile_dict(account,db)}
