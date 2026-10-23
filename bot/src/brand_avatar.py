"""One-shot official TicketTreat bot profile photo maintenance.

Enable with TICKETTREAT_APPLY_BOT_PHOTO=1 *for one deployment only*, then
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
        image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS).save(
            output, format="JPEG", quality=93, optimize=True
        )
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
    if os.getenv("TICKETTREAT_APPLY_BOT_PHOTO","").strip() != "1":
        return
    update_bot_avatar(os.getenv("BOT_TOKEN","").strip())
