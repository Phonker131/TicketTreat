"""Google authorization-code login. No email-based automatic account linking."""
from __future__ import annotations

import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit

import requests
from fastapi import Depends, Header, HTTPException, Request
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.id_token import verify_oauth2_token
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base
from demo_accounts import WebAccount, WebSession, normalize_email, token_hash
from demo_account_recovery import VerifiedEmail
from demo_auth_security import guard_rate, record_rate, verify_password
from demo_mfa import session_for, require_privileged_mfa, utc


class GoogleIdentity(Base):
    __tablename__ = "demo_google_identities"
    subject = Column(String(255), primary_key=True)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class GoogleFlow(Base):
    __tablename__ = "demo_google_flows"
    state_hash = Column(String(64), primary_key=True)
    browser_hash = Column(String(64), nullable=False)
    nonce = Column(String(64), nullable=False)
    # PKCE verifier lives only in an HttpOnly browser cookie, never in the DB.
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)
    session_hash = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)


class StartData(BaseModel):
    link: bool = False
    current_password: str | None = Field(default=None, max_length=128)


class FinishData(BaseModel):
    state: str = Field(min_length=40, max_length=128)
    browser_token: str = Field(min_length=40, max_length=128)
    code: str = Field(min_length=1, max_length=4096)


def config():
    client = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    redirect = os.getenv("GOOGLE_REDIRECT_URI", "").strip()
    url = urlsplit(redirect)
    local = os.getenv("APP_ENV", "development") != "production" and url.hostname in {"localhost", "127.0.0.1"}
    if (not client or not secret or url.path != "/api/auth/google/callback"
            or not url.hostname or url.username or url.password or url.query or url.fragment
            or (url.scheme != "https" and not (local and url.scheme == "http"))):
        raise HTTPException(503, "google_not_configured")
    return client, secret, redirect


def validate_claims(claims, client, nonce):
    if (claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}
            or claims.get("aud") != client
            or claims.get("azp", client) != client
            or not isinstance(claims.get("nonce"), str)
            or not secrets.compare_digest(claims["nonce"], nonce)
            or claims.get("email_verified") is not True
            or not isinstance(claims.get("sub"), str)
            or not 1 <= len(claims["sub"]) <= 255):
        raise HTTPException(401, "invalid_google_identity")
    normalize_email(claims.get("email", ""))
    return claims


def exchange_code(code, verifier, nonce):
    client, secret, redirect = config()
    try:
        response = requests.post("https://oauth2.googleapis.com/token", data={
            "code": code, "client_id": client, "client_secret": secret,
            "redirect_uri": redirect, "grant_type": "authorization_code",
            "code_verifier": verifier,
        }, timeout=10, allow_redirects=False)
        if response.status_code != 200:
            raise HTTPException(401, "google_exchange_failed")
        raw = response.json().get("id_token")
        if not isinstance(raw, str) or len(raw) > 16384:
            raise HTTPException(401, "invalid_google_identity")
        # Google's library checks signature, expiry, issued-at, audience, issuer.
        transport = GoogleRequest()
        def bounded_request(*args, **kwargs):
            kwargs["timeout"] = 10
            return transport(*args, **kwargs)
        claims = verify_oauth2_token(raw, bounded_request, audience=client)
        return validate_claims(claims, client, nonce)
    except HTTPException:
        raise
    except Exception:
        # Do not expose codes, tokens, secrets, or provider error bodies.
        raise HTTPException(401, "google_verification_failed") from None


def consume_flow(db, payload):
    flow = db.query(GoogleFlow).filter(GoogleFlow.state_hash == token_hash(payload.state)).with_for_update().first()
    if (flow is None or utc(flow.expires_at) <= datetime.now(timezone.utc)
            or not secrets.compare_digest(flow.browser_hash, token_hash(payload.browser_token))):
        raise HTTPException(400, "invalid_google_flow")
    values = (flow.nonce, flow.account_id, flow.session_hash)
    db.delete(flow)
    db.commit()  # consume before contacting Google; callbacks cannot be replayed
    return values


def install_google_auth(app, get_db, DemoGuest, issue_session, profile_dict):
    @app.get("/demo/auth/google/status")
    def status():
        try:
            config()
            return {"enabled": True}
        except HTTPException:
            return {"enabled": False}

    @app.post("/demo/auth/google/start")
    def start(payload: StartData, request: Request, authorization: str | None = Header(default=None),
              db: Session = Depends(get_db)):
        client, _, redirect = config()
        ip = request.client.host if request.client else "unknown"
        guard_rate(db, "google_start", ip, 60, 600)
        record_rate(db, "google_start", ip, 600)
        account_id = session_hash = None
        if payload.link:
            account, session = session_for(db, authorization)
            guard_rate(db, "google_link", str(account.id), 6, 900)
            record_rate(db, "google_link", str(account.id), 900)
            if not payload.current_password or not verify_password(payload.current_password, account.password_hash):
                raise HTTPException(401, "invalid_current_password")
            require_privileged_mfa(db, account, session)
            account_id, session_hash = account.id, session.token_hash
        state, verifier, nonce = (secrets.token_urlsafe(32) for _ in range(3))
        now = datetime.now(timezone.utc)
        db.query(GoogleFlow).filter(GoogleFlow.expires_at <= now).delete(synchronize_session=False)
        db.add(GoogleFlow(state_hash=token_hash(state), browser_hash=token_hash(verifier),
                          nonce=nonce, account_id=account_id, session_hash=session_hash,
                          expires_at=now + timedelta(minutes=10)))
        db.commit()
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
            "client_id": client, "redirect_uri": redirect, "response_type": "code",
            "scope": "openid email profile", "state": state, "nonce": nonce,
            "code_challenge": challenge, "code_challenge_method": "S256", "prompt": "select_account",
        })
        return {"url": url, "browser_token": verifier}

    @app.post("/demo/auth/google/finish")
    def finish(payload: FinishData, db: Session = Depends(get_db)):
        config()
        nonce, linked_id, session_hash = consume_flow(db, payload)
        claims = exchange_code(payload.code, payload.browser_token, nonce)
        email = normalize_email(claims["email"])
        try:
            identity = db.get(GoogleIdentity, claims["sub"])
            if linked_id is not None:
                session = db.query(WebSession).filter(WebSession.token_hash == session_hash).first()
                if session is None or session.account_id != linked_id or utc(session.expires_at) <= datetime.now(timezone.utc):
                    raise HTTPException(401, "invalid_session")
                account = db.get(WebAccount, linked_id)
                if account is None:
                    raise HTTPException(401, "invalid_session")
                require_privileged_mfa(db, account, session)
                if identity and identity.account_id != account.id:
                    raise HTTPException(409, "google_already_linked")
                other = db.query(GoogleIdentity).filter(GoogleIdentity.account_id == account.id).first()
                if other and other.subject != claims["sub"]:
                    raise HTTPException(409, "google_already_linked")
            elif identity:
                account = db.get(WebAccount, identity.account_id)
                if account is None:
                    raise HTTPException(401, "invalid_google_identity")
            else:
                if db.query(WebAccount.id).filter(WebAccount.email == email).first():
                    raise HTTPException(409, "google_link_required")
                first = str(claims.get("given_name") or claims.get("name") or "Google user").strip()[:100]
                last = str(claims.get("family_name") or "").strip()[:100]
                guest = DemoGuest(access_token=secrets.token_urlsafe(32), first_name=first, last_name=last, email=email)
                db.add(guest); db.flush()
                # Explicitly unusable password; email recovery can set one later.
                account = WebAccount(email=email, password_hash="!google-only", first_name=first,
                                     last_name=last, guest_id=guest.id, contact_preference="email")
                db.add(account); db.flush()
                from demo_roles import WebAccountRole
                db.add(WebAccountRole(account_id=account.id, role="participant"))
            if not identity:
                db.add(GoogleIdentity(subject=claims["sub"], account_id=account.id, created_at=datetime.now(timezone.utc)))
            # A differently-addressed linked Google account doesn't verify the profile email.
            if (account.email == email and (email.endswith("@gmail.com") or claims.get("hd"))
                    and db.get(VerifiedEmail, account.id) is None):
                db.add(VerifiedEmail(account_id=account.id, verified_at=datetime.now(timezone.utc)))
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "google_account_conflict") from None
        token = issue_session(db, account)  # no MFA elevation is inherited
        return {"token": token, "profile": profile_dict(account, db)}
