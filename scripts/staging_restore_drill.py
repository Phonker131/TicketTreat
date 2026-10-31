# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Restore rehearsal isolation; never point a staging restore at production.
# Do not change casually: open a PR, obtain @Phonker131 approval, run
# relevant security/DB tests and document migration or rollback impact.
# See docs/CRITICAL_CODE_AREAS.md. Comments do not enforce permissions.
"""One-shot disaster-recovery drill in an isolated local PostgreSQL 18 cluster.

No production DATABASE_URL is accepted. The encrypted backup is fetched from
private object storage, decrypted, restored on a *Unix socket only*, validated,
and removed with the ephemeral cluster on exit. Never serves an HTTP port.
"""
from __future__ import annotations

import getpass
import os
import subprocess
import tempfile
from pathlib import Path

from restore_offsite_backup import download_and_decrypt

TABLES = ("users", "registrations", "demo_tickets", "demo_web_accounts",
          "demo_privacy_requests", "tickettreat_schema_migrations")


def run(*cmd: str, env=None, timeout=240, capture=False) -> str:
    try:
        completed = subprocess.run(list(cmd), env=env, timeout=timeout, check=True,
                                   stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                                   stderr=subprocess.PIPE, text=True)
        return (completed.stdout or "").strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        # Do not leak SQL payloads, private URLs or user data via stderr.
        raise RuntimeError("isolated restore drill command failed: "+cmd[0]) from None


def newest_object(bucket: str, prefix: str) -> str:
    import boto3
    client = boto3.client("s3", endpoint_url=os.environ.get("S3_ENDPOINT_URL") or None)
    paginator = client.get_paginator("list_objects_v2")
    latest = None
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix.rstrip("/")+"/"):
        for item in page.get("Contents", []):
            key = item["Key"]
            if key.endswith(".dump.ttbk") and (latest is None or key > latest):
                latest = key
    if not latest:
        raise RuntimeError("No encrypted backups found for the configured prefix")
    return latest


def validate_archive(archive: Path, scratch: Path) -> dict[str, int]:
    data = scratch/"pgdata"
    sock = scratch/"socket"
    sock.mkdir(mode=0o700)
    run("initdb", "-D", str(data), "-A", "trust", "--no-instructions", timeout=120)
    username = getpass.getuser()
    env = {**os.environ,"PGHOST":str(sock),"PGPORT":"55666","PGUSER":username,
           "PGDATABASE":"postgres","PGPASSWORD":""}
    opts = "-c listen_addresses='' -c unix_socket_directories='"+str(sock)+ \
           "' -c port=55666 -c shared_buffers=32MB -c fsync=off"
    started = False
    try:
        run("pg_ctl", "-D", str(data), "-o", opts, "-w", "start", timeout=100)
        started = True
        run("createdb","-T","template0","tickettreat_restore_drill",env=env,timeout=30)
        run("pg_restore","--no-owner","--no-acl","--exit-on-error",
            "--dbname","tickettreat_restore_drill",str(archive),env=env,timeout=600)
        counts = {}
        for table in TABLES:
            result = run("psql","-X","-A","-t","-d","tickettreat_restore_drill",
                         "-c", "SELECT count(*) FROM "+table,env=env,timeout=30,capture=True)
            counts[table] = int(result)
        return counts
    finally:
        if started:
            run("pg_ctl","-D",str(data),"-m","immediate","-w","stop",timeout=60)


def main() -> None:
    if os.environ.get("DATABASE_URL"):
        raise RuntimeError("Restore drill must have no production DATABASE_URL")
    bucket = os.environ.get("S3_BACKUP_BUCKET","")
    if not bucket or not os.environ.get("TT_BACKUP_KEY_HEX"):
        raise RuntimeError("Bucket and backup key must be configured")
    prefix = os.environ.get("S3_BACKUP_PREFIX","tickettreat/database").strip("/")
    key = newest_object(bucket,prefix)
    scratch_root=Path("/scratch")
    scratch_root.mkdir(parents=True,exist_ok=True,mode=0o700)
    with tempfile.TemporaryDirectory(prefix="drill-",dir=scratch_root) as directory:
        folder=Path(directory)
        archive=download_and_decrypt(key,folder/"verified.dump")
        results=validate_archive(archive,folder)
        # Only aggregate table counts; never personal records or credentials.
        print("Isolated PostgreSQL 18 restore verified: "+
              ", ".join(name+"="+str(count) for name,count in results.items()),flush=True)
        print("Restored object: "+key,flush=True)


if __name__=="__main__":
    main()
