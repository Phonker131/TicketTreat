"""One-shot official TicketTreat bot profile photo maintenance.

The Railway root requirements.txt provides Pillow for image conversion.\nEnable with TICKETTREAT_APPLY_BOT_PHOTO=1 *for one deployment only*, then
remove/disable it after observing 'TicketTreat avatar successfully updated'.
Do not print BOT_TOKEN, Telegram responses or image bytes.
"""
from __future__ import annotations

import io
import json
import os
from pathlib import Path

import requests


def update_bot_avatar(bot_token: str, photo_file: Path | None = None) -> bool:
    if not bot_token:
        return False
    from PIL import Image

    root = Path(__file__).resolve().parents[2]
    source = photo_file or root / "frontend" / "public" / "app-icon-256.png"
    if not source.is_file():
        print("TicketTreat avatar image missing from deployment")
        return False
    # Never change the avatar of an old Crowdly bot even if Railway still has
    # an obsolete BOT_TOKEN. Telegram's authenticated getMe is authoritative.
    try:
        me = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            timeout=10,
        )
        info = me.json() if me.status_code == 200 else {}
        if not info.get("ok") or (info.get("result") or {}).get("username", "").casefold() != "tickettreatbot":
            print("TicketTreat avatar update skipped: BOT_TOKEN belongs to another bot")
            return False
    except (requests.RequestException, ValueError):
        print("TicketTreat avatar update skipped: unable to verify bot identity")
        return False
    # Telegram Bot API accepts a JPG InputProfilePhotoStatic, not an SVG
    # or a bare PNG; convert the approved TT image to 512x512 JPEG.
    with Image.open(source) as image:
        output = io.BytesIO()
        # Telegram chooses its own avatar circle size in chat messages; the
        # solution is smaller artwork WITHIN the uploaded photo, not trying to
        # control the Telegram UI. Keep the official cream TT brand palette.
        reduced_size = 410  # 80% of a 512px Telegram avatar image
        artwork = image.convert("RGBA").resize(
            (reduced_size, reduced_size), Image.Resampling.LANCZOS
        )
        canvas = Image.new("RGB", (512, 512), (240, 235, 225))
        canvas.paste(artwork, ((512 - reduced_size)//2, (512 - reduced_size)//2),
                     artwork.getchannel("A"))
        canvas.save(output, format="JPEG", quality=94, optimize=True)
    output.seek(0)
    try:
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setMyProfilePhoto",
            data={"photo": json.dumps({"type":"static","photo":"attach://avatar"})},
            files={"avatar":("tickettreat-avatar.jpg",output,"image/jpeg")},
            timeout=20,
        )
        # Do not include the Telegram response body, which could contain
        # sensitive operational information.
        if response.status_code == 200 and response.json().get("ok") is True:
            print("TicketTreat avatar successfully updated")
            return True
        print(f"TicketTreat avatar update unsuccessful (HTTP {response.status_code})")
    except (requests.RequestException, ValueError) as exc:
        print(f"TicketTreat avatar update unavailable ({type(exc).__name__})")
    return False


def apply_avatar_on_startup() -> None:
    enabled = os.getenv("TICKETTREAT_APPLY_BOT_PHOTO","").strip() == "1"
    print("TicketTreat avatar job enabled:", enabled, flush=True)
    if not enabled:
        return
    update_bot_avatar(os.getenv("BOT_TOKEN","").strip())
