"""Retrieve and decrypt one offsite backup for an *isolated staging* restore.

Never automatically connect to or overwrite a database. Manually run
pg_restore with the output only after checking the destination database.
Requires boto3, cryptography and the original TT_BACKUP_KEY_HEX.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
import tempfile
from pathlib import Path

from offsite_backup import backup_key,decrypt_file


def download_and_decrypt(object_key:str,target:Path) -> Path:
    if not object_key.startswith(os.getenv("S3_BACKUP_PREFIX","tickettreat/database/").strip("/")+"/"):
        raise ValueError("Object key is outside the configured TicketTreat backup prefix")
    if not target.is_absolute() or target.exists():
        raise ValueError("Destination must be an unused absolute file path")
    bucket=os.environ.get("S3_BACKUP_BUCKET","")
    if not bucket:raise ValueError("S3_BACKUP_BUCKET missing")
    import boto3
    client=boto3.client("s3",endpoint_url=os.getenv("S3_ENDPOINT_URL") or None)
    expected=client.head_object(Bucket=bucket,Key=object_key).get("Metadata",{}).get("sha256")
    if not expected or len(expected)!=64:
        raise RuntimeError("Missing upload checksum metadata")
    target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="restore-",dir=target.parent) as temp_dir:
        encrypted=Path(temp_dir)/"encrypted.ttbk"
        client.download_file(bucket,object_key,str(encrypted))
        digester=hashlib.sha256()
        with encrypted.open("rb") as source:
            while chunk:=source.read(1024*1024):
                digester.update(chunk)
        if digester.hexdigest()!=expected:
            raise RuntimeError("Backup checksum mismatch; refuse restore")
        decrypt_file(encrypted,target,backup_key())
    print(f"Backup decrypted into private staging file: {target}")
    return target


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--s3-key",required=True)
    parser.add_argument("--destination",type=Path,required=True)
    args=parser.parse_args()
    try:
        download_and_decrypt(args.s3_key,args.destination)
    except Exception as exc:
        print("Restore preparation failed:",str(exc),file=sys.stderr)
        raise SystemExit(1) from exc
