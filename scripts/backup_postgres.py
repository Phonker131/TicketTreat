"""Create a private PostgreSQL custom-format backup without leaking URLs to argv.

Usage: DATABASE_URL=... python scripts/backup_postgres.py --output-dir /mnt/backups
Output must be on durable encrypted storage, NOT Railway's ephemeral filesystem.
No job schedule is created here; configure a dedicated backup service/scheduler.
"""
from __future__ import annotations
import argparse
import hashlib
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, unquote, parse_qs


def libpq_env(uri: str) -> dict[str,str]:
    parts=urlsplit(uri.replace("postgresql+psycopg2://","postgresql://",1))
    if parts.scheme!="postgresql" or not parts.hostname:
        raise ValueError("DATABASE_URL must be an explicit PostgreSQL connection string")
    env=os.environ.copy()
    env.update({
        "PGHOST":parts.hostname,
        "PGPORT":str(parts.port or 5432),
        "PGDATABASE":unquote(parts.path.lstrip("/")),
        "PGUSER":unquote(parts.username or ""),
        "PGPASSWORD":unquote(parts.password or ""),
    })
    query=parse_qs(parts.query)
    if "sslmode" in query:env["PGSSLMODE"]=query["sslmode"][-1]
    if not env["PGDATABASE"] or not env["PGUSER"]:
        raise ValueError("Connection URL must specify username and database")
    return env


def backup(outdir: Path, database_url: str) -> Path:
    if not outdir.is_absolute():
        raise ValueError("Backup output directory must be absolute")
    outdir.mkdir(parents=True,exist_ok=True,mode=0o700)
    env=libpq_env(database_url)
    timestamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive=outdir/f"tickettreat-{timestamp}-{os.urandom(3).hex()}.dump"
    fd,tempname=tempfile.mkstemp(prefix=".partial-",suffix=".dump",dir=outdir)
    os.close(fd)
    temp=Path(tempname)
    try:
        subprocess.run(["pg_dump","--format=custom","--no-owner","--no-acl",
                        "--file",str(temp)],env=env,check=True,timeout=3600)
        if temp.stat().st_size < 100:
            raise RuntimeError("Backup unexpectedly small")
        os.chmod(temp,0o600)
        os.replace(temp,archive)
        sha=hashlib.sha256(archive.read_bytes()).hexdigest()
        checksum=archive.with_suffix(".sha256")
        checksum.write_text(f"{sha}  {archive.name}\n")
        os.chmod(checksum,0o600)
        print(f"Created UNENCRYPTED archive for transfer to encrypted offsite storage: {archive.name} ({archive.stat().st_size} bytes)")
        return archive
    finally:
        if temp.exists():temp.unlink()


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output-dir",type=Path,required=True)
    args=parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        parser.error("DATABASE_URL missing")
    backup(args.output_dir,os.environ["DATABASE_URL"])
