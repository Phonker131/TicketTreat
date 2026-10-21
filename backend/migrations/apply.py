"""Apply reviewed SQL migrations once, transactionally, with PostgreSQL locking.

Usage from repo root:
  DATABASE_URL=postgresql://... python backend/migrations/apply.py

Do not use on production without a verified backup and restore rehearsal.
Existing SQL migration files must never be edited after application.
"""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent
SCHEMA = "tickettreat_schema_migrations"
ADVISORY_LOCK = 736972655573


def migrations():
    for file in sorted(ROOT.glob("20*.sql")):
        source = file.read_bytes()
        yield file.name, source.decode("utf-8"), hashlib.sha256(source).hexdigest()


def apply(database_url: str) -> list[str]:
    if not database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
        raise RuntimeError("PostgreSQL DATABASE_URL is required")
    engine = create_engine(database_url, pool_pre_ping=True)
    applied = []
    try:
        # Use one transaction for advisory locking, schema updates and ledger.
        with engine.begin() as conn:
            conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": ADVISORY_LOCK})
            conn.exec_driver_sql(f"""CREATE TABLE IF NOT EXISTS {SCHEMA} (
                filename VARCHAR(255) PRIMARY KEY,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )""")
            tables = conn.execute(text(
                "SELECT to_regclass('public.demo_web_accounts')"
            )).scalar()
            if tables is None:
                raise RuntimeError("Existing TicketTreat schema not found; initialize a staging copy first")
            for filename, sql, digest in migrations():
                prior = conn.execute(text(
                    f"SELECT checksum FROM {SCHEMA} WHERE filename=:filename"
                ), {"filename": filename}).scalar()
                if prior is not None:
                    if prior != digest:
                        raise RuntimeError(f"Applied migration modified: {filename}")
                    continue
                # SQL files are reviewed internal artifacts, not user input.
                # Transactions belong to the migration runner, not individual files.
                source = sql.strip()
                if source.upper().startswith("BEGIN;"):
                    source = source[len("BEGIN;"):].strip()
                if source.upper().endswith("COMMIT;"):
                    source = source[:-len("COMMIT;")].strip()
                conn.exec_driver_sql(source)
                conn.execute(text(
                    f"INSERT INTO {SCHEMA}(filename,checksum) VALUES(:filename,:checksum)"
                ), {"filename": filename, "checksum": digest})
                applied.append(filename)
    finally:
        engine.dispose()
    return applied


if __name__ == "__main__":
    value = os.environ.get("DATABASE_URL", "")
    try:
        applied = apply(value)
        print("Applied:", ", ".join(applied) if applied else "none (schema up to date)")
    except Exception as exc:
        print("Migration aborted:", str(exc), file=sys.stderr)
        raise SystemExit(1) from exc
