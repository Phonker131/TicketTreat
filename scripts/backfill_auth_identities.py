"""Operator-only, transactional verified-identity ledger backfill.

Default is read-only dry-run. Never invoked from startup/migration/CI deploy.
Use only after a verified backup, restore drill and the read-only audit.
No email, Telegram ID, Google subject or credentials are emitted.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from sqlalchemy import create_engine, text

from audit_auth_identities import CANDIDATES, audit

ADVISORY_LOCK = 736972655574


def backfill(database_url: str) -> dict[str, int]:
    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.begin() as conn:
            conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": ADVISORY_LOCK})
            conn.exec_driver_sql("LOCK TABLE auth_identities IN SHARE ROW EXCLUSIVE MODE")
            # Preflight again inside this transaction. Collision must stop
            # the whole operation before writing a single identity.
            checks = (
                "SELECT count(*) FROM (SELECT provider,provider_subject FROM candidates "
                "GROUP BY provider,provider_subject HAVING count(DISTINCT account_id)>1) duplicates",
                "SELECT count(*) FROM (SELECT account_id,provider FROM candidates "
                "GROUP BY account_id,provider HAVING count(DISTINCT provider_subject)>1) duplicates",
                "SELECT count(*) FROM candidates WHERE provider_subject IS NULL "
                "OR length(btrim(provider_subject))=0",
            )
            for query in checks:
                if conn.execute(text(CANDIDATES + query)).scalar_one() != 0:
                    raise RuntimeError("identity_candidate_conflict")
            conn.execute(text(CANDIDATES + """
                INSERT INTO auth_identities(account_id, provider, provider_subject, verified_at)
                SELECT account_id, provider, provider_subject, verified_at
                FROM candidates WHERE true
                ON CONFLICT DO NOTHING
            """))
            missing = conn.execute(text(CANDIDATES + """
                SELECT count(*) FROM candidates c
                LEFT JOIN auth_identities ai
                  ON ai.provider=c.provider AND ai.provider_subject=c.provider_subject
                 AND ai.account_id=c.account_id
                WHERE ai.id IS NULL
            """)).scalar_one()
            if missing:
                raise RuntimeError("identity_backfill_conflict_rolled_back")
            candidates = conn.execute(text(CANDIDATES + "SELECT count(*) FROM candidates")).scalar_one()
            return {"verified_candidates": int(candidates), "unmatched_after_backfill": int(missing)}
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Safe TicketTreat provider identity migration")
    parser.add_argument("--apply", action="store_true", help="Write verified identities after explicit approval")
    parser.add_argument("--confirmed-restored-backup", action="store_true",
                        help="A backup was restored and independently validated")
    args = parser.parse_args()
    database_url = os.getenv("DATABASE_URL", "")
    try:
        report = audit(database_url)
        if not report["safe_to_backfill"]:
            print(json.dumps({"status": "blocked", "audit": report}, sort_keys=True))
            return 2
        if not args.apply:
            print(json.dumps({"status": "dry_run_only", "audit": report}, sort_keys=True))
            return 0
        if (not args.confirmed_restored_backup
                or os.getenv("TICKETTREAT_AUTH_BACKFILL_APPROVED") != "YES"):
            print("Write blocked: restore confirmation and explicit approval required", file=sys.stderr)
            return 2
        result = backfill(database_url)
        print(json.dumps({"status": "backfilled", **result}, sort_keys=True))
        return 0
    except Exception as exc:
        # Never include SQL parameters or connection strings in operational logs.
        print("Backfill aborted: " + type(exc).__name__, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
