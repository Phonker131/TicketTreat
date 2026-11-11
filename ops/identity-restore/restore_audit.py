"""One-shot encrypted backup restore and identity preflight in a LOCAL PostgreSQL.

The worker has S3 backup credentials but NO production DATABASE_URL. It starts
an isolated PostgreSQL 18 instance in its own ephemeral private filesystem,
restores the latest offsite snapshot, and applies the *additive* registry schema
to that local copy only. It logs aggregate counts without raw identities.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

import boto3
from sqlalchemy import create_engine, text
from restore_offsite_backup import download_and_decrypt
from audit_auth_identities import audit
from backfill_auth_identities import backfill

SCRATCH = Path("/identity-scratch")
PORT = "55432"
MIGRATION = Path("/identity-worker/identity-migration.sql")


def run(argv: list[str], *, env: dict[str, str] | None = None) -> None:
    subprocess.run(argv, check=True, timeout=300, env=env,
                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def latest_backup_key() -> str:
    bucket = os.environ["S3_BACKUP_BUCKET"]
    prefix = os.environ.get("S3_BACKUP_PREFIX", "tickettreat/database/").strip("/") + "/"
    client = boto3.client("s3", endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None)
    latest = None
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".ttbk") and (latest is None or obj["LastModified"] > latest[0]):
                latest = (obj["LastModified"], key)
    if latest is None:
        raise RuntimeError("no_encrypted_backup_available")
    return latest[1]


def inspect_local(uri: str) -> dict[str, int]:
    engine = create_engine(uri, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            return {
                "tickets": int(connection.execute(text("SELECT count(*) FROM demo_tickets")).scalar_one()),
                "registrations": int(connection.execute(text("SELECT count(*) FROM registrations")).scalar_one()),
                "accounts": int(connection.execute(text("SELECT count(*) FROM demo_web_accounts")).scalar_one()),
            }
    finally:
        engine.dispose()


def perform() -> int:
    # A production URL must never be injected into this container, even by
    # accidental variable cloning from the existing backup worker.
    if os.getenv("DATABASE_URL") or os.getenv("DATABASE_PUBLIC_URL"):
        raise RuntimeError("production_database_url_must_not_be_present")
    SCRATCH.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.TemporaryDirectory(prefix="identity-restore-", dir=SCRATCH) as tmp:
        root = Path(tmp)
        archive = download_and_decrypt(latest_backup_key(), root / "source.dump")
        run(["pg_restore", "--list", str(archive)])
        data = root / "pgdata"
        run(["initdb", "-D", str(data), "--auth-local=trust",
             "--auth-host=reject", "--no-instructions", "--no-sync"])
        postgres_args = (
            "-c listen_addresses='' "
            f"-c unix_socket_directories={root} "
            f"-c port={PORT} -c fsync=off"
        )
        env = dict(os.environ, PGHOST=str(root), PGPORT=PORT, PGUSER="postgres",
                   PGDATABASE="identity_audit")
        started = False
        try:
            run(["pg_ctl", "-D", str(data), "-o", postgres_args, "-w", "start"], env=env)
            started = True
            run(["createdb", "identity_audit"], env=env)
            run(["pg_restore", "--no-owner", "--no-acl", "--exit-on-error",
                 "--dbname", "identity_audit", str(archive)], env=env)
            run(["psql", "-v", "ON_ERROR_STOP=1", "-d", "identity_audit",
                 "-f", str(MIGRATION)], env=env)
            local = (
                "postgresql+psycopg2://postgres@/identity_audit?"
                + "host=" + quote(str(root), safe="") + "&port=" + PORT
            )
            before = inspect_local(local)
            report = audit(local)
            if not report["safe_to_backfill"]:
                print(json.dumps({"status": "blocked_on_restored_snapshot",
                                  "counts": before, "audit": report}, sort_keys=True))
                return 2
            migrated = backfill(local)
            after = inspect_local(local)
            if before != after:
                raise RuntimeError("account_or_ticket_rows_changed_on_restore")
            second = audit(local)
            if not second["safe_to_backfill"] or second["registry_orphan_bindings"]:
                raise RuntimeError("restored_backfill_integrity_mismatch")
            print(json.dumps({"status": "restore_drill_passed",
                              "snapshot_counts": before,
                              "audit": second, "backfill": migrated}, sort_keys=True))
            return 0
        finally:
            if started:
                run(["pg_ctl", "-D", str(data), "-m", "immediate", "-w", "stop"],
                    env=env)


if __name__ == "__main__":
    try:
        raise SystemExit(perform())
    except Exception as exc:
        # Never leak S3 keys, PII, SQL parameters or connection strings in logs.
        print("Restore audit blocked: " + type(exc).__name__, file=sys.stderr)
        raise SystemExit(1) from None
