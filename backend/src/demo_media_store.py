"""Private S3-compatible event media with bounded image normalization.

Configure all four S3_* environment variables in Railway staging. Existing
PostgreSQL images remain readable. Missing/incomplete configuration never
silently publishes objects or redirects attendees to storage credentials.
"""
from __future__ import annotations
import io
import os
import uuid
from fastapi import HTTPException


def configured():
    names=("S3_ENDPOINT_URL","S3_ACCESS_KEY_ID","S3_SECRET_ACCESS_KEY","S3_BUCKET_NAME")
    values=[os.getenv(name,"").strip() for name in names]
    if any(values) and not all(values):
        raise HTTPException(503,"media_storage_incomplete")
    return all(values)


def client():
    import boto3
    if not configured():
        raise HTTPException(503,"media_storage_not_configured")
    return boto3.client("s3",endpoint_url=os.environ["S3_ENDPOINT_URL"],
                       aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
                       aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
                       region_name=os.getenv("S3_REGION","auto"))


def normalized_webp(blob):
    from PIL import Image,ImageOps,UnidentifiedImageError
    try:
        Image.MAX_IMAGE_PIXELS=18_000_000
        with Image.open(io.BytesIO(blob)) as src:
            src.verify()
        with Image.open(io.BytesIO(blob)) as src:
            im=ImageOps.exif_transpose(src)
            im.thumbnail((1920,1920))
            if im.mode not in {"RGB","RGBA"}:im=im.convert("RGB")
            out=io.BytesIO()
            im.save(out,"WEBP",quality=82,method=5)
            data=out.getvalue()
            if len(data)>2_000_000:
                raise HTTPException(413,"optimized_image_too_large")
            return data
    except (UnidentifiedImageError,OSError,ValueError):
        raise HTTPException(422,"invalid_gallery_image") from None


def store(event_id,blob):
    if not configured():
        raise HTTPException(503,"media_storage_not_configured")
    object_key=f"events/{int(event_id)}/{uuid.uuid4().hex}.webp"
    data=normalized_webp(blob)
    try:
        client().put_object(Bucket=os.environ["S3_BUCKET_NAME"],Key=object_key,
                            Body=data,ContentType="image/webp",
                            CacheControl="private, max-age=3600")
    except Exception:
        raise HTTPException(502,"media_storage_write_failed") from None
    return object_key,"image/webp"


def load(object_key):
    if not object_key.startswith("events/") or ".." in object_key:
        raise HTTPException(400,"media_key_invalid")
    try:
        response=client().get_object(Bucket=os.environ["S3_BUCKET_NAME"],Key=object_key)
        # Upload enforces 2MB; prevent unlimited streaming on corrupt buckets.
        data=response["Body"].read(2_000_001)
        if len(data)>2_000_000:
            raise HTTPException(502,"media_storage_object_too_large")
        return data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502,"media_storage_read_failed") from None


def remove(object_key):
    if not object_key.startswith("events/") or ".." in object_key:
        return
    try:
        client().delete_object(Bucket=os.environ["S3_BUCKET_NAME"],Key=object_key)
    except Exception:
        # Orphan cleanup can be safely retried out-of-band.
        import logging
        logging.getLogger("tickettreat.media").exception("gallery_object_cleanup_failed")
