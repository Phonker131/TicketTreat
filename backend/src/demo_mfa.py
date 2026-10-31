# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Privileged MFA TOTP, encrypted factor secrets and session elevation. Never add bypasses.
# Do not change casually: open a PR, obtain @Phonker131 approval, run
# relevant security/DB tests and document rollback or migration risk.
# See docs/CRITICAL_CODE_AREAS.md. Comments do not enforce permissions.
"""TOTP multifactor authentication for privileged website accounts.

This module protects server-side organizer/admin APIs using a per-session
MFA elevation. Secrets are encrypted with a distinct Fernet key in PostgreSQL.
There are no bypass/recovery codes: losing a factor requires manual identity
proofing by an authorized operator, not a self-service secret reset.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import struct
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, LargeBinary, String
from sqlalchemy.orm import Session

from db.base import Base
from demo_accounts import WebAccount, WebSession, token_hash
from demo_auth_security import guard_rate, record_rate, verify_password

STEP_SECONDS = 30
ASSURANCE_HOURS = 12


class MFAFactor(Base):
    __tablename__ = "demo_mfa_factors"
    account_id = Column(Integer, primary_key=True)
    encrypted_secret = Column(LargeBinary, nullable=False)
    enabled_at = Column(DateTime(timezone=True), nullable=True)
    last_counter = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class MFASession(Base):
    __tablename__ = "demo_mfa_sessions"
    session_hash = Column(String(64), primary_key=True)
    account_id = Column(Integer, nullable=False, index=True)
    verified_until = Column(DateTime(timezone=True), nullable=False)


class PasswordProof(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)


class TOTPProof(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def cipher() -> Fernet:
    key = os.getenv("MFA_ENCRYPTION_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="mfa_key_not_configured")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, TypeError):
        raise HTTPException(status_code=503, detail="mfa_key_invalid") from None


def session_for(db: Session, authorization: str | None) -> tuple[WebAccount, WebSession]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "login_required")
    raw = authorization[7:].strip()
    if not 30 <= len(raw) <= 160:
        raise HTTPException(401, "invalid_session")
    session=db.query(WebSession).filter(WebSession.token_hash == token_hash(raw)).first()
    if session is None or utc(session.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(401, "invalid_session")
    account=db.query(WebAccount).filter(WebAccount.id == session.account_id).first()
    if account is None:
        raise HTTPException(401, "invalid_session")
    return account,session


def _code(secret: bytes, counter: int) -> str:
    digest=hmac.new(secret,struct.pack(">Q",counter),hashlib.sha1).digest()
    offset=digest[-1] & 0x0F
    number=(int.from_bytes(digest[offset:offset+4],"big") & 0x7fffffff) % 1_000_000
    return f"{number:06d}"


def match_counter(secret: bytes, candidate: str, now: int | None = None, after: int = -1) -> int | None:
    current=(int(time.time()) if now is None else now)//STEP_SECONDS
    for counter in (current-1,current,current+1):
        if counter > after and counter>=0 and hmac.compare_digest(_code(secret,counter),candidate):
            return counter
    return None


def require_privileged_mfa(db: Session, account: WebAccount, session: WebSession) -> None:
    if os.getenv("APP_ENV","development").strip().lower() != "production":
        return
    from demo_roles import role_for
    if role_for(db,account) not in {"organizer","global_admin"}:
        return
    factor=db.get(MFAFactor,account.id)
    if factor is None or factor.enabled_at is None:
        raise HTTPException(403,"mfa_enrollment_required")
    assertion=db.get(MFASession,session.token_hash)
    if assertion is None or assertion.account_id != account.id or utc(assertion.verified_until) <= datetime.now(timezone.utc):
        raise HTTPException(403,"mfa_challenge_required")


def elevate(db: Session, account_id: int, session: WebSession) -> None:
    exp=min(utc(session.expires_at),datetime.now(timezone.utc)+timedelta(hours=ASSURANCE_HOURS))
    record=db.get(MFASession,session.token_hash)
    if record is None:
        db.add(MFASession(session_hash=session.token_hash,account_id=account_id,verified_until=exp))
    else:
        record.verified_until=exp


def install_mfa(app, get_db):
    @app.get("/demo/auth/mfa/status")
    def status(authorization: str | None = Header(default=None),db:Session=Depends(get_db)):
        account, session=session_for(db,authorization)
        factor=db.get(MFAFactor,account.id)
        assertion=db.get(MFASession,session.token_hash)
        return {"enabled":bool(factor and factor.enabled_at),
                "elevated":bool(assertion and assertion.account_id==account.id and utc(assertion.verified_until)>datetime.now(timezone.utc)),
                "needs_setup":not bool(factor and factor.enabled_at)}

    @app.post("/demo/auth/mfa/start")
    def start(payload: PasswordProof, authorization: str | None=Header(default=None),
              db:Session=Depends(get_db)):
        account,_=session_for(db,authorization)
        from demo_roles import role_for
        if role_for(db,account) not in {"organizer","global_admin"}:
            raise HTTPException(403,"privileged_account_required")
        guard_rate(db,"mfa_start",str(account.id),5,3600)
        record_rate(db,"mfa_start",str(account.id),3600)
        if not verify_password(payload.current_password,account.password_hash):
            raise HTTPException(403,"password_confirmation_failed")
        factor=db.get(MFAFactor,account.id)
        if factor is not None and factor.enabled_at is not None:
            raise HTTPException(409,"mfa_already_enabled")
        raw=secrets.token_bytes(20)
        encrypted=cipher().encrypt(raw)
        if factor is None:
            factor=MFAFactor(account_id=account.id, encrypted_secret=encrypted,
                              created_at=datetime.now(timezone.utc))
            db.add(factor)
        else:
            factor.encrypted_secret=encrypted
            factor.last_counter=None
        db.commit()
        base32=base64.b32encode(raw).decode().rstrip("=")
        name=quote(f"TicketTreat:{account.email}",safe="")
        issuer=quote("TicketTreat",safe="")
        return {"secret":base32,
                "otpauth_url":f"otpauth://totp/{name}?secret={base32}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"}

    def verify(db: Session,authorization: str | None,code: str,should_enable: bool):
        account,session=session_for(db,authorization)
        guard_rate(db,"mfa_verify",str(account.id),10,900)
        record_rate(db,"mfa_verify",str(account.id),900)
        factor=db.query(MFAFactor).filter(MFAFactor.account_id==account.id).with_for_update().first()
        if factor is None or (should_enable and factor.enabled_at) or (not should_enable and not factor.enabled_at):
            raise HTTPException(409,"mfa_state_invalid")
        try:
            encoded=cipher().decrypt(factor.encrypted_secret)
        except InvalidToken:
            raise HTTPException(503,"mfa_key_decryption_failed") from None
        counter=match_counter(encoded,code,after=factor.last_counter if factor.last_counter is not None else -1)
        if counter is None:
            raise HTTPException(401,"invalid_mfa_code")
        factor.last_counter=counter
        if should_enable:
            factor.enabled_at=datetime.now(timezone.utc)
        elevate(db,account.id,session)
        db.commit()
        return {"enabled":True,"elevated":True,"assurance_hours":ASSURANCE_HOURS}

    @app.post("/demo/auth/mfa/confirm")
    def confirm(payload:TOTPProof,authorization:str|None=Header(default=None),
                db:Session=Depends(get_db)):
        return verify(db,authorization,payload.code,True)

    @app.post("/demo/auth/mfa/elevate")
    def challenge(payload:TOTPProof,authorization:str|None=Header(default=None),
                  db:Session=Depends(get_db)):
        return verify(db,authorization,payload.code,False)
