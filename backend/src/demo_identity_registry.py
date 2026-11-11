# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Shadow-only verification ledger. Do NOT use as an authentication source
# until existing legacy mappings are audited and explicitly backfilled.
"""Atomic, idempotent PostgreSQL claims of independently verified identities.

Call only after verification by email OTP, Google ID token or Telegram signed
initData/OIDC. The caller owns the transaction; never implicitly commit or
transfer a verified identity between accounts.
"""
from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from sqlalchemy import text as sql_text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from demo_accounts import AuthIdentity, normalize_email


class IdentityConflict(ValueError):
    """Provider credential already belongs to another account or conflicts."""


def canonical_subject(provider: str, verified_subject: str) -> str:
    if provider not in {"email", "google", "telegram"}:
        raise ValueError("unsupported_identity_provider")
    if not isinstance(verified_subject, str) or not verified_subject or len(verified_subject) > 255:
        raise ValueError("invalid_verified_subject")
    if provider == "email":
        # May be called only after independent OTP/email-provider verification.
        return normalize_email(verified_subject)
    if provider == "telegram":
        # Telegram OIDC sub is NOT the Bot API identity. Only a verified
        # Telegram user id may be passed in as this provider subject.
        if not verified_subject.isascii() or not verified_subject.isdecimal():
            raise ValueError("invalid_telegram_user_id")
        identifier = int(verified_subject)
        if not 0 < identifier < 2**63:
            raise ValueError("invalid_telegram_user_id")
        return str(identifier)
    if verified_subject != verified_subject.strip():
        raise ValueError("invalid_google_subject")
    return verified_subject


def claim_verified_identity(
    db: Session, *,
    account_id: int,
    provider: str,
    verified_subject: str,
    verified_at: datetime | None = None,
) -> AuthIdentity:
    """Idempotent claim; PostgreSQL constraints serialize concurrent inserts.

    No trust is inferred from an email/name/string: the caller must have
    independently authenticated that specific provider subject.
    """
    if type(account_id) is not int or account_id <= 0:
        raise ValueError("invalid_account_id")
    subject = canonical_subject(provider, verified_subject)
    timestamp = verified_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        raise ValueError("verified_at_must_include_timezone")

    # DO NOTHING without a conflict target handles both uniqueness rules.
    # A concurrent transaction with the same subject blocks until its insert
    # resolves; the winner's committed owner is then checked below.
    db.execute(
        pg_insert(AuthIdentity).values(
            account_id=account_id,
            provider=provider,
            provider_subject=subject,
            verified_at=timestamp,
        ).on_conflict_do_nothing()
    )
    identity = (
        db.query(AuthIdentity)
        .filter(AuthIdentity.provider == provider, AuthIdentity.provider_subject == subject)
        .with_for_update()
        .first()
    )
    if identity is None or identity.account_id != account_id:
        # Fail closed. A provider credential must never silently change owner.
        raise IdentityConflict("verified_identity_already_claimed")
    return identity


def registry_enabled() -> bool:
    """Explicit opt-in only after restored-database preflight and backfill."""
    return os.getenv("TICKETTREAT_IDENTITY_REGISTRY_MODE", "off") in {"shadow", "enforce"}


def mirror_verified_identity(
    db: Session, *,
    account_id: int,
    provider: str,
    verified_subject: str,
) -> None:
    """Write independently proven claims beside legacy data, in caller's TX.

    No registry access when the feature is off; never derive proof from a
    user-submitted email or a Telegram display name.
    """
    if not registry_enabled():
        return
    from fastapi import HTTPException
    try:
        claim_verified_identity(db, account_id=account_id,
                                provider=provider, verified_subject=verified_subject)
    except IdentityConflict:
        raise HTTPException(status_code=409, detail="verified_identity_conflict") from None


def transfer_verified_telegram(
    db: Session, *,
    previous_account_id: int | None,
    target_account_id: int,
    telegram_user_id: int,
) -> None:
    """Transfer ONLY with verified Telegram proof and authenticated target.

    The caller must independently verify the target web session and signed
    Telegram identity, and must have checked the previous account is an
    email-less, participant-only Telegram shadow before this function.
    """
    if not registry_enabled():
        return
    from fastapi import HTTPException
    subject = canonical_subject("telegram", str(telegram_user_id))
    row = db.query(AuthIdentity).filter(
        AuthIdentity.provider == "telegram",
        AuthIdentity.provider_subject == subject,
    ).with_for_update().first()
    if row is None:
        mirror_verified_identity(db, account_id=target_account_id,
                                 provider="telegram", verified_subject=subject)
    elif row.account_id == target_account_id:
        return
    elif previous_account_id is not None and row.account_id == previous_account_id:
        # Existing shadow sessions have been revoked by the caller.
        other = db.query(AuthIdentity.id).filter(
            AuthIdentity.provider == "telegram",
            AuthIdentity.account_id == target_account_id,
        ).first()
        if other is not None:
            raise HTTPException(409, "website_account_has_another_telegram")
        row.account_id = target_account_id
        db.flush()
    else:
        raise HTTPException(status_code=409, detail="verified_identity_conflict")


def serialize_telegram_principal(db: Session, telegram_user_id: int) -> None:
    """Serialize first-time Telegram guest/account provisioning on PostgreSQL.

    A unique constraint prevents duplicate identities, but without this lock a
    second real login may get a 409 after the first wins. Use an advisory
    transaction lock *before* loading/creating provider identity rows; no
    external network calls may occur while holding it.
    """
    subject = canonical_subject("telegram", str(telegram_user_id))
    # Dedicated namespace derived from SHA-256; no user identifier is logged,
    # and a signed int64 key is accepted by PostgreSQL advisory locks.
    raw = hashlib.sha256(("tickettreat:telegram-principal:v1:" + subject).encode()).digest()
    lock_key = int.from_bytes(raw[:8], byteorder="big", signed=True)
    db.execute(sql_text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})


def enforce_registry_mode() -> bool:
    """Active only after production source/ledger reconciliation and canary."""
    return os.getenv("TICKETTREAT_IDENTITY_REGISTRY_MODE", "off") == "enforce"


def authenticated_provider_account(db: Session, provider: str,
                                   verified_subject: str):
    """Resolve a proved provider subject from the constrained identity ledger.

    In shadow/off mode callers continue to use the existing legacy owner.
    In enforce mode a previously verified provider row is the account source
    of truth. A missing row can denote a brand-new identity, but if the legacy
    provider table already knows that subject, the caller MUST fail closed.
    """
    if not enforce_registry_mode():
        return None
    from fastapi import HTTPException
    from demo_accounts import WebAccount
    subject = canonical_subject(provider, verified_subject)
    row = db.query(AuthIdentity).filter(
        AuthIdentity.provider == provider,
        AuthIdentity.provider_subject == subject,
    ).first()
    if row is None:
        return None
    account = db.get(WebAccount, row.account_id)
    if account is None:
        raise HTTPException(409, "verified_identity_registry_incomplete")
    return account


def require_registry_owner(db: Session, *, provider: str,
                           verified_subject: str, legacy_account_id: int) -> None:
    """Verify an existing signed/OTP credential resolves to the same owner.

    Missing ledger claims are not guessed or migrated on the login path.
    They require the explicitly controlled, separately audited backfill.
    """
    if not enforce_registry_mode():
        return
    from fastapi import HTTPException
    account = authenticated_provider_account(db, provider, verified_subject)
    if account is None:
        raise HTTPException(409, "verified_identity_registry_backfill_required")
    if account.id != legacy_account_id:
        raise HTTPException(409, "verified_identity_owner_mismatch")
