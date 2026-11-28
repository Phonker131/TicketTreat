# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Facebook Login code exchange, one-time browser-bound state and account linking.
# Do not merge without security review, migration backup, and staging verification.
"""Server-side Facebook Login. Identity comes from Meta's app-scoped user ID.

An email match is NOT authorization to attach an existing TicketTreat account.
Facebook does not provide an OIDC verified-email assertion: new accounts do not
receive TicketTreat VerifiedEmail status until our own email challenge succeeds.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit

import requests
from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base
from demo_accounts import WebAccount, WebSession, normalize_email, token_hash
from demo_auth_security import guard_rate, record_rate, verify_password
from demo_client_ip import source_ip as authenticated_client_ip
from demo_disposable_email import require_signup_email_allowed
from demo_mfa import require_privileged_mfa, session_for, utc

logger = logging.getLogger("tickettreat.facebook_oauth")
GRAPH_VERSION = "v27.0"
GRAPH_ORIGIN = "https://graph.facebook.com"


class FacebookIdentity(Base):
    __tablename__ = "demo_facebook_identities"
    subject = Column(String(255), primary_key=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class FacebookFlow(Base):
    __tablename__ = "demo_facebook_flows"
    state_hash = Column(String(64), primary_key=True)
    browser_hash = Column(String(64), nullable=False)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)
    session_hash = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)


class FacebookPending(Base):
    __tablename__ = "demo_facebook_pending"
    token_hash = Column(String(64), primary_key=True)
    subject = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    code_hash = Column(String(64), nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)


class StartData(BaseModel):
    link: bool = False
    current_password: str | None = Field(default=None, max_length=128)


class FinishData(BaseModel):
    state: str = Field(min_length=40, max_length=128)
    browser_token: str = Field(min_length=40, max_length=128)
    code: str = Field(min_length=1, max_length=4096)


class ConfirmData(BaseModel):
    code: str = Field(pattern=r"^\d{8}$")
    privacy_accepted: bool
    privacy_version: str = Field(default="2026-10", pattern=r"^2026-10$")


def email_code_hash(email: str, code: str):
    secret = os.getenv("AUTH_CODE_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(503, "auth_code_secret_not_configured")
    return hmac.new(secret.encode(), f"facebook:{email}:{code}".encode(), hashlib.sha256).hexdigest()


def config():
    client = os.getenv("FACEBOOK_APP_ID", "").strip()
    secret = os.getenv("FACEBOOK_APP_SECRET", "").strip()
    redirect = os.getenv("FACEBOOK_REDIRECT_URI", "").strip()
    url = urlsplit(redirect)
    local = os.getenv("APP_ENV", "development") != "production" and url.hostname in {"localhost", "127.0.0.1"}
    if (not client.isdecimal() or len(client) > 40 or len(secret) < 16
            or url.path != "/api/auth/facebook/callback"
            or not url.hostname or url.username or url.password or url.query or url.fragment
            or (url.scheme != "https" and not (local and url.scheme == "http"))):
        raise HTTPException(503, "facebook_not_configured")
    return client, secret, redirect


def _get_json(path: str, params: dict, error_name: str):
    """All requests use fixed Meta hosts; no tokens, codes or bodies in logs."""
    try:
        response = requests.get(GRAPH_ORIGIN + "/" + GRAPH_VERSION + "/" + path,
                                params=params, timeout=10, allow_redirects=False)
        if response.status_code != 200:
            logger.warning("Facebook OAuth rejected: endpoint=%s http=%s", path, response.status_code)
            raise HTTPException(401, error_name)
        payload = response.json()
        if not isinstance(payload, dict):
            raise HTTPException(401, error_name)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Facebook OAuth provider error: endpoint=%s type=%s", path, type(exc).__name__)
        raise HTTPException(401, error_name) from None


def exchange_code(code: str):
    """Validate token audience, validity, subject AND matching /me identity."""
    client, secret, redirect = config()
    token_data = _get_json("oauth/access_token", {
        "client_id": client, "client_secret": secret,
        "redirect_uri": redirect, "code": code,
    }, "facebook_exchange_failed")
    access_token = token_data.get("access_token")
    if not isinstance(access_token, str) or not 30 <= len(access_token) <= 4096:
        raise HTTPException(401, "invalid_facebook_identity")
    debug = _get_json("debug_token", {
        "input_token": access_token, "access_token": client + "|" + secret,
    }, "facebook_verification_failed").get("data")
    now = int(datetime.now(timezone.utc).timestamp())
    if (not isinstance(debug, dict) or debug.get("is_valid") is not True
            or str(debug.get("app_id")) != client or debug.get("type") != "USER"
            or not isinstance(debug.get("user_id"), str)
            or not 1 <= len(debug["user_id"]) <= 255
            or not debug["user_id"].isdecimal()
            or not isinstance(debug.get("expires_at"), int)
            or debug["expires_at"] <= now):
        raise HTTPException(401, "invalid_facebook_identity")
    proof = hmac.new(secret.encode(), access_token.encode(), hashlib.sha256).hexdigest()
    profile = _get_json("me", {
        "fields": "id,first_name,last_name,name,email", "access_token": access_token,
        "appsecret_proof": proof,
    }, "facebook_verification_failed")
    if (not isinstance(profile.get("id"), str)
            or not secrets.compare_digest(profile["id"], debug["user_id"])):
        raise HTTPException(401, "invalid_facebook_identity")
    return profile


def consume_flow(db: Session, payload: FinishData):
    flow = db.query(FacebookFlow).filter(
        FacebookFlow.state_hash == token_hash(payload.state)).with_for_update().first()
    if (flow is None or utc(flow.expires_at) <= datetime.now(timezone.utc)
            or not secrets.compare_digest(flow.browser_hash, token_hash(payload.browser_token))):
        raise HTTPException(400, "invalid_facebook_flow")
    details = (flow.account_id, flow.session_hash)
    db.delete(flow)
    db.commit()  # Always consume before external token exchange; no replay.
    return details


def install_facebook_auth(app, get_db, DemoGuest, issue_session, profile_dict):
    @app.get("/demo/auth/facebook/status")
    def status():
        try:
            config()
            return {"enabled": True}
        except HTTPException:
            return {"enabled": False}

    @app.post("/demo/auth/facebook/start")
    def start(payload: StartData, request: Request, authorization: str | None = Header(default=None),
              db: Session = Depends(get_db)):
        client, _, redirect = config()
        ip = authenticated_client_ip(request)
        guard_rate(db, "facebook_start", ip, 30, 600)
        record_rate(db, "facebook_start", ip, 600)
        account_id = session_hash = None
        if payload.link:
            account, session = session_for(db, authorization)
            guard_rate(db, "facebook_link", str(account.id), 6, 900)
            record_rate(db, "facebook_link", str(account.id), 900)
            if not payload.current_password or not verify_password(payload.current_password, account.password_hash):
                raise HTTPException(401, "invalid_current_password")
            require_privileged_mfa(db, account, session)
            account_id, session_hash = account.id, session.token_hash
        state, browser_token = (secrets.token_urlsafe(32) for _ in range(2))
        now = datetime.now(timezone.utc)
        db.query(FacebookFlow).filter(FacebookFlow.expires_at <= now).delete(synchronize_session=False)
        db.add(FacebookFlow(state_hash=token_hash(state), browser_hash=token_hash(browser_token),
                            account_id=account_id, session_hash=session_hash,
                            expires_at=now + timedelta(minutes=10)))
        db.commit()
        url = "https://www.facebook.com/" + GRAPH_VERSION + "/dialog/oauth?" + urlencode({
            "client_id": client, "redirect_uri": redirect, "response_type": "code",
            "scope": "public_profile,email", "state": state,
        })
        return {"url": url, "browser_token": browser_token}

    @app.post("/demo/auth/facebook/finish")
    def finish(payload: FinishData, request: Request, db: Session = Depends(get_db)):
        config()
        linked_id, linked_session_hash = consume_flow(db, payload)
        profile = exchange_code(payload.code)
        subject = profile["id"]
        try:
            identity = db.get(FacebookIdentity, subject)
            if linked_id is not None:
                session = db.query(WebSession).filter(WebSession.token_hash == linked_session_hash).first()
                if session is None or session.account_id != linked_id or utc(session.expires_at) <= datetime.now(timezone.utc):
                    raise HTTPException(401, "invalid_session")
                account = db.get(WebAccount, linked_id)
                if account is None:
                    raise HTTPException(401, "invalid_session")
                from demo_account_bans import require_account_active
                require_account_active(db, account)
                require_privileged_mfa(db, account, session)
                if identity and identity.account_id != account.id:
                    raise HTTPException(409, "facebook_already_linked")
                other = db.query(FacebookIdentity).filter(FacebookIdentity.account_id == account.id).first()
                if other and other.subject != subject:
                    raise HTTPException(409, "facebook_already_linked")
            elif identity:
                account = db.get(WebAccount, identity.account_id)
                if account is None:
                    raise HTTPException(401, "invalid_facebook_identity")
            else:
                # Meta does not assert verified email. Prove ownership with
                # TicketTreat's eight-digit email OTP BEFORE provisioning.
                raw_email = profile.get("email")
                if not isinstance(raw_email, str) or not raw_email:
                    raise HTTPException(422, "facebook_email_required")
                email = normalize_email(raw_email)
                require_signup_email_allowed(email)
                if db.query(WebAccount.id).filter(WebAccount.email == email).first():
                    raise HTTPException(409, "facebook_link_required")
                from demo_email import configured
                from demo_account_recovery import send_code
                if not configured():
                    raise HTTPException(503, "email_provider_unavailable")
                guard_rate(db, "facebook_email", email, 4, 3600)
                record_rate(db, "facebook_email", email, 3600)
                now = datetime.now(timezone.utc)
                db.query(FacebookPending).filter(FacebookPending.expires_at <= now).delete(synchronize_session=False)
                first = str(profile.get("first_name") or profile.get("name") or "Facebook user").strip()[:100]
                last = str(profile.get("last_name") or "").strip()[:100]
                code = f"{secrets.randbelow(100_000_000):08d}"
                pending_token = secrets.token_urlsafe(32)
                db.add(FacebookPending(token_hash=token_hash(pending_token),subject=subject,
                                       email=email,first_name=first,last_name=last,
                                       code_hash=email_code_hash(email,code),attempts=0,
                                       expires_at=now+timedelta(minutes=10)))
                send_code(email,"quick",code)
                db.commit()
                return JSONResponse(status_code=202,content={
                    "status":"email_verification_required","pending_token":pending_token,
                })
            if not identity:
                db.add(FacebookIdentity(subject=subject, account_id=account.id,
                                        created_at=datetime.now(timezone.utc)))
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "facebook_account_conflict") from None
        # Facebook sessions never carry privileged MFA elevation.
        token = issue_session(db, account)
        return {"token": token, "profile": profile_dict(account, db)}

    @app.post("/demo/auth/facebook/confirm")
    def confirm(payload: ConfirmData, request: Request,
                x_facebook_pending_proof: str | None = Header(default=None),
                db: Session = Depends(get_db)):
        config()
        ip = authenticated_client_ip(request)
        guard_rate(db,"facebook_confirm",ip,25,3600)
        record_rate(db,"facebook_confirm",ip,3600)
        if not x_facebook_pending_proof or not 40 <= len(x_facebook_pending_proof) <= 128:
            raise HTTPException(401,"facebook_pending_required")
        pending = db.query(FacebookPending).filter(
            FacebookPending.token_hash==token_hash(x_facebook_pending_proof)).with_for_update().first()
        if pending is None or utc(pending.expires_at)<=datetime.now(timezone.utc) or pending.attempts>=5:
            raise HTTPException(400,"invalid_or_expired_code")
        if payload.privacy_accepted is not True:
            raise HTTPException(422,"privacy_acceptance_required")
        pending.attempts+=1
        if not secrets.compare_digest(pending.code_hash,email_code_hash(pending.email,payload.code)):
            db.commit()
            raise HTTPException(400,"invalid_or_expired_code")
        if db.query(WebAccount.id).filter(WebAccount.email==pending.email).first() or db.get(FacebookIdentity,pending.subject):
            db.delete(pending)
            db.commit()
            raise HTTPException(409,"facebook_link_required")
        from demo_roles import WebAccountRole
        from demo_quick_signup import QuickPrivacyConsent
        from demo_account_recovery import VerifiedEmail
        from demo_identity_registry import mirror_verified_identity
        now=datetime.now(timezone.utc)
        guest=DemoGuest(access_token=secrets.token_urlsafe(32),first_name=pending.first_name,
                        last_name=pending.last_name,email=pending.email)
        db.add(guest);db.flush()
        account=WebAccount(email=pending.email,password_hash="!facebook-only",first_name=pending.first_name,
                           last_name=pending.last_name,guest_id=guest.id,contact_preference="email")
        db.add(account);db.flush()
        db.add(WebAccountRole(account_id=account.id,role="participant"))
        db.add(VerifiedEmail(account_id=account.id,verified_at=now))
        mirror_verified_identity(db,account_id=account.id,provider="email",verified_subject=pending.email)
        db.add(QuickPrivacyConsent(account_id=account.id,version=payload.privacy_version,accepted_at=now))
        db.add(FacebookIdentity(subject=pending.subject,account_id=account.id,created_at=now))
        db.delete(pending)
        try:db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409,"facebook_account_conflict") from None
        token=issue_session(db,account)
        return {"token":token,"profile":profile_dict(account,db)}
