"""Argon2id hashes, legacy PBKDF2 verification and PostgreSQL rate limits."""
from __future__ import annotations
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import HTTPException
from sqlalchemy import Column, DateTime, Integer, String, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session
from db.base import Base

# OWASP Argon2id baseline: memory 19 MiB, iterations 2, parallelism 1.
HASHER = PasswordHasher(time_cost=2, memory_cost=19*1024, parallelism=1, hash_len=32, salt_len=16, type=Type.ID)
# A per-process, valid Argon2id hash used for absent users, so unknown emails
# do not skip the password verification work and reveal account existence.
DUMMY_PASSWORD_HASH = HASHER.hash(secrets.token_urlsafe(32))

class AuthRateBucket(Base):
    __tablename__ = "demo_auth_rate_buckets"
    bucket_hash = Column(String(64), primary_key=True)
    attempts = Column(Integer, nullable=False, default=0)
    window_expires_at = Column(DateTime(timezone=True), nullable=False)

def hash_password(password: str) -> str:
    return HASHER.hash(password)

def verify_password(password: str, stored: str) -> bool:
    if stored.startswith("$argon2id$"):
        try:
            return HASHER.verify(stored, password)
        except (VerifyMismatchError, VerificationError, InvalidHashError, ValueError):
            return False
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _, rounds, salt, expected = stored.split("$", 3)
            count = int(rounds)
            if not 200_000 <= count <= 1_000_000:
                return False
            value = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), count)
            return hmac.compare_digest(value, bytes.fromhex(expected))
        except (ValueError, TypeError):
            return False
    return False

def needs_rehash(stored: str) -> bool:
    if stored.startswith("pbkdf2_sha256$"):
        return True
    if stored.startswith("$argon2id$"):
        try:
            return HASHER.check_needs_rehash(stored)
        except (InvalidHashError, ValueError):
            return True
    return True

def validate_new_password(password: str) -> None:
    if not 12 <= len(password) <= 128 or not password.strip():
        raise HTTPException(status_code=422, detail="password_length_12_to_128")

def _key(namespace: str, identifier: str) -> str:
    return hashlib.sha256((namespace + ":" + identifier).encode()).hexdigest()

def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

def guard_rate(db: Session, namespace: str, identifier: str, limit: int, seconds: int) -> None:
    row = db.get(AuthRateBucket, _key(namespace, identifier))
    if row and _utc(row.window_expires_at) > datetime.now(timezone.utc) and row.attempts >= limit:
        raise HTTPException(status_code=429, detail="too_many_attempts", headers={"Retry-After": str(seconds)})

def record_rate(db: Session, namespace: str, identifier: str, seconds: int) -> None:
    now = datetime.now(timezone.utc)
    key = _key(namespace, identifier)
    db.execute(pg_insert(AuthRateBucket).values(
        bucket_hash=key, attempts=0, window_expires_at=now + timedelta(seconds=seconds),
    ).on_conflict_do_nothing(index_elements=[AuthRateBucket.bucket_hash]))
    row = db.execute(select(AuthRateBucket).where(AuthRateBucket.bucket_hash == key).with_for_update()).scalar_one()
    if _utc(row.window_expires_at) <= now:
        row.attempts = 0
        row.window_expires_at = now + timedelta(seconds=seconds)
    row.attempts += 1
    db.commit()

def clear_rate(db: Session, namespace: str, identifier: str) -> None:
    row = db.get(AuthRateBucket, _key(namespace, identifier))
    if row is not None:
        db.delete(row)
        db.commit()
