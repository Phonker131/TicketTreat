# TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED
# Encrypted database backups: secret keys, protected storage and recovery integrity.
# Do not change casually: open a PR, obtain @Phonker131 approval, run
# relevant integration tests and document security/rollback impact.
# See docs/CRITICAL_CODE_AREAS.md. Comments do not enforce permissions.
"""Encrypted offsite PostgreSQL backup for a dedicated Railway cron worker.

Requires: pip install -r backend/src/requirements.txt boto3
Environment: DATABASE_URL, TT_BACKUP_KEY_HEX (64 hex characters),
S3_BACKUP_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
AWS_DEFAULT_REGION; S3_ENDPOINT_URL optional.
Never deploy this worker with a public domain or reuse the frontend service.

Usage:
  python scripts/offsite_backup.py --scratch-dir /tmp/tickettreat-private-backup

Plain pg_dump data exists *temporarily* in a mode-0700 directory; this
process removes it in a finally block. S3 objects are encrypted *before*
upload and also server-side encrypted. Schedule, object retention, alerts,
IAM and successful live restore still must be configured by operators.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import secrets
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC=b"TTBK1"
BLOCK=1024*1024


def backup_key() -> bytes:
    raw=os.environ.get("TT_BACKUP_KEY_HEX","")
    if len(raw)!=64:
        raise RuntimeError("TT_BACKUP_KEY_HEX must be a 32-byte hex key (64 characters)")
    try:
        key=bytes.fromhex(raw)
    except ValueError as exc:
        raise RuntimeError("Invalid backup encryption key") from exc
    if key==bytes(32):
        raise RuntimeError("Zero-value backup encryption key is forbidden")
    return key


def encrypt_file(source:Path,destination:Path,key:bytes) -> str:
    """Streaming AES-256-GCM; file contains 5-byte magic, IV, ciphertext, tag."""
    nonce=secrets.token_bytes(12)
    cipher=Cipher(algorithms.AES(key),modes.GCM(nonce)).encryptor()
    digest=hashlib.sha256()
    with source.open("rb") as incoming, destination.open("xb") as out:
        os.chmod(destination,0o600)
        header=MAGIC+nonce
        out.write(header);digest.update(header)
        while data:=incoming.read(BLOCK):
            encrypted=cipher.update(data)
            out.write(encrypted);digest.update(encrypted)
        tail=cipher.finalize()
        if tail:out.write(tail);digest.update(tail)
        out.write(cipher.tag);digest.update(cipher.tag)
    return digest.hexdigest()


def decrypt_file(source:Path,destination:Path,key:bytes) -> None:
    """For offline staging restore only; reject tampered/incomplete ciphertext."""
    length=source.stat().st_size
    if length<len(MAGIC)+12+16:
        raise ValueError("Truncated encrypted backup")
    with source.open("rb") as incoming:
        head=incoming.read(17)
        if head[:5]!=MAGIC:
            raise ValueError("Unsupported backup format")
        incoming.seek(-16,2)
        tag=incoming.read(16)
        incoming.seek(17)
        decryptor=Cipher(algorithms.AES(key),modes.GCM(head[5:],tag)).decryptor()
        encrypted_length=length-17-16
        try:
            with destination.open("xb") as out:
                os.chmod(destination,0o600)
                while encrypted_length:
                    chunk=incoming.read(min(BLOCK,encrypted_length))
                    if not chunk:raise ValueError("Unexpected end of encrypted backup")
                    out.write(decryptor.update(chunk))
                    encrypted_length-=len(chunk)
                out.write(decryptor.finalize())
        except Exception:
            destination.unlink(missing_ok=True)
            raise


def perform(scratch:Path) -> str:
    from backup_postgres import backup
    if not scratch.is_absolute():
        raise ValueError("scratch path must be absolute")
    bucket=os.getenv("S3_BACKUP_BUCKET","").strip()
    if not bucket:
        raise RuntimeError("S3_BACKUP_BUCKET missing; refusing local-only backup")
    key=backup_key()
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("Install boto3 in the dedicated backup worker") from exc
    client=boto3.client("s3",endpoint_url=os.getenv("S3_ENDPOINT_URL") or None)
    if not os.environ.get("DATABASE_URL","").strip():
        raise RuntimeError("DATABASE_URL missing; refusing empty backup")
    prefix=os.getenv("S3_BACKUP_PREFIX","tickettreat/database/").strip("/")
    with tempfile.TemporaryDirectory(prefix="backup-",dir=scratch) as directory:
        workspace=Path(directory)
        plain=backup(workspace,os.environ["DATABASE_URL"])
        encrypted=workspace/(plain.name+".ttbk")
        checksum=encrypt_file(plain,encrypted,key)
        # Minimize exposure of the temporary plaintext file.
        plain.unlink()
        plain.with_suffix(".sha256").unlink(missing_ok=True)
        object_key=f"{prefix}/{datetime.now(timezone.utc):%Y/%m/%d}/{encrypted.name}"
        extra={"Metadata":{"sha256":checksum,"format":"aes256gcm-ttbk1"}}
        # S3-compatible providers can reject SSE headers. AES-GCM encryption
        # is mandatory on the client; request SSE only when explicitly enabled.
        if os.getenv("S3_BACKUP_SERVER_SIDE_ENCRYPTION","").lower()=="aes256":
            extra["ServerSideEncryption"]="AES256"
        client.upload_file(str(encrypted),bucket,object_key,ExtraArgs=extra)
        meta=client.head_object(Bucket=bucket,Key=object_key)
        if meta.get("Metadata",{}).get("sha256")!=checksum:
            raise RuntimeError("Uploaded backup checksum metadata mismatch")
        # Download the actual remote object, compare its digest, decrypt it,
        # and validate the PostgreSQL archive before declaring success.
        downloaded=workspace/"downloaded.ttbk"
        client.download_file(bucket,object_key,str(downloaded))
        with downloaded.open("rb") as source:
            remote_hash=hashlib.file_digest(source,"sha256").hexdigest()
        if not secrets.compare_digest(remote_hash,checksum):
            raise RuntimeError("Remote object checksum mismatch")
        restored=workspace/"restore-test.dump"
        decrypt_file(downloaded,restored,key)
        subprocess.run(["pg_restore","--list",str(restored)],
                       timeout=120,check=True,stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE)
        restored.unlink()
        downloaded.unlink()
        # Only object path is logged: no connection strings, secrets or PII.
        print(f"Verified encrypted PostgreSQL backup: s3://{bucket}/{object_key}")
        return object_key


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--scratch-dir",type=Path,required=True)
    args=parser.parse_args()
    args.scratch_dir.mkdir(parents=True,exist_ok=True,mode=0o700)
    perform(args.scratch_dir)
