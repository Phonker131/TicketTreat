"""Use the *public website's* TicketTreat hero artwork in /start messages.

No user-controlled URL, Telegram token, account data or tracking is sent.
Downloads are bounded; cached in this bot process; text-only fallback is safe.
"""
from __future__ import annotations

import io
import time

import requests

# Same website hero media used on the live TicketTreat frontend.
WELCOME_IMAGE_URL = "https://tickettreat.eu/brand/posters/hero-720.webp"
_cached: bytes | None = None
_retry_after: float = 0.0


def welcome_photo_bytes() -> bytes | None:
    global _cached, _retry_after
    if _cached:
        return _cached
    if time.monotonic() < _retry_after:
        return None
    try:
        from PIL import Image, ImageOps
        response = requests.get(WELCOME_IMAGE_URL, timeout=6, stream=True)
        response.raise_for_status()
        # Do not load oversized or unexpected HTML error responses as pictures.
        if int(response.headers.get("Content-Length") or 0) > 4_000_000:
            raise ValueError("image_too_large")
        if not response.headers.get("Content-Type", "").lower().startswith("image/"):
            raise ValueError("unexpected_content_type")
        parts, size = [], 0
        for piece in response.iter_content(chunk_size=32768):
            size += len(piece)
            if size > 4_000_000:
                raise ValueError("image_too_large")
            parts.append(piece)
        with Image.open(io.BytesIO(b"".join(parts))) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            image.save(out, format="JPEG", quality=87, optimize=True)
            _cached = out.getvalue()
            return _cached
    except (requests.RequestException, ValueError, OSError) as exc:
        # The welcome message remains functional when website media is offline.
        print("TicketTreat welcome photo unavailable:", type(exc).__name__, flush=True)
        _retry_after = time.monotonic() + 600
        return None
