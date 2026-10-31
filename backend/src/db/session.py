# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Database URL, connection pool and request-scoped sessions. Changes can affect every API request, transaction and ticket registration.
# Do not change this file casually. Open a PR and request @Phonker131 review;
# run security/DB integration tests and document migration or rollback impact.
# See docs/CRITICAL_CODE_AREAS.md (comments alone do not enforce access).
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not configured")


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=30,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
