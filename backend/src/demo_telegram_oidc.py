"""Official Telegram OpenID Connect login for existing and new TicketTreat users.

The verified Telegram subject resolves to exactly one canonical guest. The web
session uses the existing HttpOnly gateway and existing WebAccount authorization.
Never infer provider ownership from names, Telegram usernames or unverified email.
Requires BotFather Login Widget client ID, secret and registered redirect URI.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, urlsplit

import requests
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from db.base import Base

ISSUER = "https://oauth.telegram.org"
AUTH_URL = ISSUER + "/auth"
TOKEN_URL = ISSUER + "/token"
JWKS_URL = ISSUER + "/.well-known/jwks.json"
FLOW_AGE = 600

logger = logging.getLogger("tickettreat.telegram_oidc")
# Only fixed categories. Never emit OIDC codes, JWTs, claims, client secrets,
# Telegram identifiers, exception strings from network clients or response bodies.
_SAFE_VERIFY_CATEGORIES = frozenset({
    "invalid_token", "unsupported_algorithm", "missing_key", "key_service_unavailable",
    "invalid_key_set", "unknown_signing_key", "invalid_key", "invalid_issuer",
    "invalid_audience", "invalid_nonce", "invalid_token_times", "invalid_subject",
    "missing_telegram_user_id", "invalid_signature",
})
_PROVIDER_OAUTH_ERRORS = frozenset({
    "invalid_client", "invalid_grant", "invalid_request", "unauthorized_client",
    "unsupported_grant_type", "server_error", "temporarily_unavailable",
})


class TelegramOidcFlow(Base):
    __tablename__ = "demo_telegram_oidc_flows"
    state_hash = Column(String(64), primary_key=True)
    verifier_hash = Column(String(64), nullable=False)
    nonce = Column(String(100), nullable=False)
    account_id = Column(Integer, ForeignKey("demo_web_accounts.id"), nullable=True)
    session_hash = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class StartTelegramLogin(BaseModel):
    link: bool = False


class FinishTelegramLogin(BaseModel):
    code: str = Field(min_length=8, max_length=4096)
    state: str = Field(min_length=20, max_length=128)
    browser_token: str = Field(min_length=20, max_length=128)


def credentials() -> tuple[str, str, str]:
    client = os.getenv("TELEGRAM_LOGIN_CLIENT_ID", "").strip()
    secret = os.getenv("TELEGRAM_LOGIN_CLIENT_SECRET", "").strip()
    redirect = os.getenv("TELEGRAM_LOGIN_REDIRECT_URI", "").strip()
    parsed = urlsplit(redirect)
    if (not client.isdecimal() or not 1 <= len(client) <= 20 or len(secret) < 16
            or parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.query or parsed.fragment
            or parsed.path != "/api/auth/telegram/callback"
            or not parsed.hostname
            or (os.getenv("APP_ENV", "").lower() == "production"
                and parsed.hostname not in {"tickettreat.eu", "www.tickettreat.eu"})):
        raise HTTPException(503, "telegram_login_not_configured")
    return client, secret, redirect


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _b64url(data: str) -> bytes:
    if len(data) > 8192:
        raise ValueError("invalid_token")
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def verify_id_token(id_token: str, client_id: str, nonce: str, *, at: int | None = None) -> dict:
    """Fail-closed RS256 Telegram JWKS verification; no third-party JWT trust."""
    try:
        if len(id_token) > 16384 or id_token.count(".") != 2:
            raise ValueError("invalid_token")
        protected, payload, signature = id_token.split(".")
        header = json.loads(_b64url(protected))
        if not isinstance(header, dict) or header.get("alg") != "RS256":
            raise ValueError("unsupported_algorithm")
        kid = header.get("kid")
        if not isinstance(kid, str) or not 1 <= len(kid) <= 128:
            raise ValueError("missing_key")
        response = requests.get(JWKS_URL, timeout=8, allow_redirects=False)
        if response.status_code != 200 or len(response.content) > 65536:
            raise ValueError("key_service_unavailable")
        keys = response.json().get("keys")
        if not isinstance(keys, list):
            raise ValueError("invalid_key_set")
        key = next((item for item in keys if isinstance(item, dict)
                    and item.get("kid") == kid and item.get("kty") == "RSA"
                    and item.get("alg", "RS256") == "RS256"
                    and item.get("use", "sig") == "sig"), None)
        if key is None:
            raise ValueError("unknown_signing_key")
        n = int.from_bytes(_b64url(key["n"]), "big")
        e = int.from_bytes(_b64url(key["e"]), "big")
        if n.bit_length() < 2048 or e not in {65537, 3}:
            raise ValueError("invalid_key")
        rsa.RSAPublicNumbers(e, n).public_key().verify(
            _b64url(signature), (protected + "." + payload).encode("ascii"),
            padding.PKCS1v15(), hashes.SHA256())
        claims = json.loads(_b64url(payload))
        current = int(time.time()) if at is None else at
        if not isinstance(claims, dict) or claims.get("iss") != ISSUER:
            raise ValueError("invalid_issuer")
        if claims.get("aud") != client_id:
            raise ValueError("invalid_audience")
        if claims.get("nonce") != nonce:
            raise ValueError("invalid_nonce")
        if (type(claims.get("iat")) is not int or type(claims.get("exp")) is not int
                or claims["iat"] > current + 60 or claims["exp"] <= current
                or claims["exp"] - claims["iat"] > 86400):
            raise ValueError("invalid_token_times")
        sub = claims.get("sub")
        if (not isinstance(sub, str) or not sub.isdecimal()
                or not 0 < int(sub) < 2**63):
            raise ValueError("invalid_subject")
        # Telegram's OIDC 'sub' is a different principal identifier from
        # the Bot API/Mini App numeric user ID. NEVER substitute sub for id:
        # doing so could attach a person's tickets to an unrelated account.
        # Some signed profile payloads encode this numeric ID as a decimal
        # JSON string. Accept either representation after signature, aud,
        # issuer, nonce, state/PKCE and expiry have been verified.
        raw_id = claims.get("id")
        if type(raw_id) is int:
            telegram_id = raw_id
        elif (type(raw_id) is str and 1 <= len(raw_id) <= 19
              and raw_id.isascii() and raw_id.isdigit()):
            telegram_id = int(raw_id)
        else:
            id_kind = ("absent" if "id" not in claims else
                       "null" if raw_id is None else
                       "string" if type(raw_id) is str else "unexpected_type")
            logger.warning("telegram_oidc_user_id_unusable kind=%s", id_kind)
            raise ValueError("missing_telegram_user_id")
        if not 0 < telegram_id < 2**63:
            logger.warning("telegram_oidc_user_id_unusable kind=out_of_range")
            raise ValueError("missing_telegram_user_id")
        # Normalize only the verified numeric Bot API claim. The caller uses
        # the canonical integer to resolve the exact existing Telegram user.
        return {**claims, "id": telegram_id}
    except (ValueError, TypeError, KeyError, IndexError, OverflowError, binascii.Error, UnicodeError,
            InvalidSignature, requests.RequestException, json.JSONDecodeError) as exc:
        category = "invalid_signature" if isinstance(exc, InvalidSignature) else (
            str(exc) if type(exc) is ValueError and str(exc) in _SAFE_VERIFY_CATEGORIES
            else "malformed_or_unverified_token"
        )
        logger.warning("telegram_oidc_verify_failed category=%s", category)
        raise HTTPException(401, "invalid_telegram_oidc_identity") from None


def exchange(code: str, verifier: str, redirect: str, client: str, secret: str, nonce: str) -> dict:
    try:
        response = requests.post(TOKEN_URL, data={
            "grant_type": "authorization_code", "code": code,
            "client_id": client, "redirect_uri": redirect, "code_verifier": verifier,
        }, auth=(client, secret), timeout=12, allow_redirects=False)
        if response.status_code != 200:
            provider_error = "unknown"
            if len(response.content) <= 4096:
                try:
                    error_name = response.json().get("error")
                    if error_name in _PROVIDER_OAUTH_ERRORS:
                        provider_error = error_name
                except (ValueError, AttributeError, TypeError):
                    pass
            logger.warning(
                "telegram_oidc_token_rejected status=%s provider_error=%s",
                response.status_code, provider_error,
            )
            raise ValueError("token_exchange_failed")
        if len(response.content) > 65536:
            raise ValueError("oversized_token_response")
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get("id_token"), str):
            raise ValueError("missing_id_token")
        return verify_id_token(payload["id_token"], client, nonce)
    except (ValueError, requests.RequestException, json.JSONDecodeError) as exc:
        category = (str(exc) if type(exc) is ValueError
                    and str(exc) in {"token_exchange_failed", "oversized_token_response", "missing_id_token"}
                    else "token_request_or_response_error")
        logger.warning("telegram_oidc_exchange_failed category=%s", category)
        raise HTTPException(401, "telegram_login_exchange_failed") from None


def consumed_flow(db: Session, state: str, verifier: str):
    row = db.query(TelegramOidcFlow).filter(
        TelegramOidcFlow.state_hash == digest(state)).with_for_update().first()
    if (row is None or not secrets.compare_digest(row.verifier_hash, digest(verifier))
            or _utc(row.expires_at) <= datetime.now(timezone.utc)):
        raise HTTPException(400, "invalid_telegram_login_flow")
    values = row.nonce, row.account_id, row.session_hash
    db.delete(row)
    db.commit()  # Consume before network I/O, so replay is impossible.
    return values


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def ensure_telegram_web_account(db: Session, DemoGuest, claims: dict, *,
                                reconcile: bool = True, commit: bool = True):
    """A signed Mini App or OIDC Telegram user reuses the SAME guest ID."""
    from demo_telegram import DemoTelegramIdentity
    from demo_accounts import WebAccount
    from demo_roles import WebAccountRole

    telegram_id = int(claims["id"])
    from demo_identity_registry import (
        serialize_telegram_principal, authenticated_provider_account,
        enforce_registry_mode,
    )
    serialize_telegram_principal(db, telegram_id)
    registry_account = authenticated_provider_account(db, "telegram", str(telegram_id))
    link = db.query(DemoTelegramIdentity).filter(
        DemoTelegramIdentity.telegram_id == telegram_id).with_for_update().first()
    if link is None:
        if registry_account is not None:
            # A proven Telegram credential already belongs to one canonical
            # account. Missing legacy mapping is a migration inconsistency,
            # not permission to create a second guest or move tickets.
            raise HTTPException(409, "verified_identity_registry_incomplete")
        name = str(claims.get("given_name") or claims.get("name") or "Telegram user").strip()[:100]
        name = name or "Telegram user"
        guest = DemoGuest(
            access_token=secrets.token_urlsafe(32), telegram_id=telegram_id,
            first_name=name, last_name=str(claims.get("family_name") or "")[:100] or None,
            username=str(claims.get("preferred_username") or "")[:255] or None,
            email=None,
        )
        db.add(guest)
        db.flush()
        db.add(DemoTelegramIdentity(telegram_id=telegram_id, guest_id=guest.id))
        db.flush()
    else:
        guest = db.query(DemoGuest).filter(DemoGuest.id == link.guest_id).with_for_update().first()
        if guest is None:
            raise HTTPException(409, "telegram_identity_incomplete")
    account = db.query(WebAccount).filter(WebAccount.guest_id == guest.id).first()
    if enforce_registry_mode() and link is not None:
        # Existing signed Telegram mapping must already be represented in the
        # verified provider ledger before enforce cutover is enabled.
        if registry_account is None:
            raise HTTPException(409, "verified_identity_registry_backfill_required")
        if account is None or registry_account.id != account.id:
            raise HTTPException(409, "verified_identity_owner_mismatch")
    if account is None:
        account = WebAccount(
            email=None, password_hash="!telegram-only", guest_id=guest.id,
            first_name=guest.first_name or "Telegram user",
            last_name=guest.last_name or "", contact_preference="telegram",
        )
        db.add(account)
        db.flush()
        db.add(WebAccountRole(account_id=account.id, role="participant"))
    from demo_identity_registry import mirror_verified_identity
    mirror_verified_identity(db, account_id=account.id, provider="telegram",
                             verified_subject=str(telegram_id))
    if not commit and reconcile:
        raise ValueError("legacy_reconciliation_requires_commit")
    if commit:
        db.commit()
    else:
        # For legacy registration, keep the event row lock until the QR
        # ticket, legacy claim and canonical principal commit together.
        db.flush()
    # The older /myevents bot created legacy registrations before the
    # canonical Mini App existed. The first *website* Telegram login must
    # reconcile eligible free passes too; otherwise these users see an
    # apparently empty ticket list until they separately open Mini App.
    # Paid/past/conflicting legacy registrations stay untouched for review.
    if reconcile:
        from demo_legacy import reconcile_free_legacy
        from importlib import import_module
        reconcile_free_legacy(db, import_module("main"), telegram_id, guest.id)
    return account


def install_telegram_oidc(app, get_db, DemoGuest, issue_session, profile_dict):
    @app.get("/demo/auth/telegram/status")
    def status():
        try:
            credentials()
            return {"enabled": True}
        except HTTPException:
            return {"enabled": False}

    @app.post("/demo/auth/telegram/start")
    def start(payload: StartTelegramLogin, request: Request,
              authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        client, _, redirect = credentials()
        from demo_auth_security import guard_rate, record_rate
        from demo_accounts import token_hash
        from demo_mfa import session_for, require_privileged_mfa
        from demo_account_recovery import email_is_verified
        ip = request.client.host if request.client else "unknown"
        guard_rate(db, "telegram_oidc_start", ip, 50, 600)
        record_rate(db, "telegram_oidc_start", ip, 600)
        account_id = session_hash = None
        if payload.link:
            account, session = session_for(db, authorization)
            if not email_is_verified(db, account.id):
                raise HTTPException(403, "email_verification_required")
            require_privileged_mfa(db, account, session)
            account_id, session_hash = account.id, session.token_hash
        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        db.query(TelegramOidcFlow).filter(
            TelegramOidcFlow.expires_at <= datetime.now(timezone.utc)).delete(synchronize_session=False)
        db.add(TelegramOidcFlow(
            state_hash=digest(state), verifier_hash=digest(verifier), nonce=nonce,
            account_id=account_id, session_hash=session_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=FLOW_AGE)))
        db.commit()
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        url = AUTH_URL + "?" + urlencode({
            "client_id":client,"redirect_uri":redirect,"response_type":"code",
            "scope":"openid profile","state":state,"nonce":nonce,
            "code_challenge":challenge,"code_challenge_method":"S256",
        })
        return {"url":url,"browser_token":verifier}

    @app.post("/demo/auth/telegram/finish")
    def finish(payload: FinishTelegramLogin, background_tasks: BackgroundTasks,
               db: Session = Depends(get_db)):
        client, secret, redirect = credentials()
        nonce, linked_id, session_hash = consumed_flow(db, payload.state, payload.browser_token)
        claims = exchange(payload.code, payload.browser_token, redirect, client, secret, nonce)
        from demo_accounts import WebAccount, WebSession
        from demo_mfa import require_privileged_mfa
        from demo_telegram import _telegram_link
        from demo_account_recovery import email_is_verified
        if linked_id is not None:
            session = db.query(WebSession).filter(WebSession.token_hash == session_hash).first()
            if session is None or session.account_id != linked_id or _utc(session.expires_at) <= datetime.now(timezone.utc):
                raise HTTPException(401, "invalid_session")
            account = db.get(WebAccount, linked_id)
            if account is None or not email_is_verified(db, account.id):
                raise HTTPException(403, "email_verification_required")
            require_privileged_mfa(db, account, session)
            _telegram_link(db, __import__("main"), account, {
                "id": int(claims["id"]),
                "first_name": str(claims.get("given_name") or claims.get("name") or "Telegram user"),
                "last_name": str(claims.get("family_name") or ""),
                "username": str(claims.get("preferred_username") or ""),
            }, background_tasks)
        else:
            try:
                account = ensure_telegram_web_account(db, DemoGuest, claims)
            except IntegrityError:
                db.rollback()
                # Simultaneous OAuth callbacks cannot create duplicate mappings.
                # The user may retry a new authorization flow.
                raise HTTPException(409, "telegram_login_retry") from None
        token = issue_session(db, account)
        return {"token":token,"profile":profile_dict(account, db)}
