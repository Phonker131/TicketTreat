"""TicketTreat Telegram avatar from the official mark and welcome postcard.

The avatar keeps the approved brand mark; /start uses its separate, branded
cream, blue and coral 16:9 postcard (never the dark wordmark layout).
"""
from __future__ import annotations

import io
import json
import os
from functools import lru_cache
from pathlib import Path

import requests

ASSET_ROOT = Path(__file__).resolve().parents[1] / "assets"
MARK_SVG = ASSET_ROOT / "tickettreat-mark.svg"
WORDMARK_SVG = ASSET_ROOT / "tickettreat-wordmark-on-dark.svg"
WELCOME_SVG = ASSET_ROOT / "tickettreat-welcome.svg"
NIGHT = (2, 7, 10, 255)


def _render_svg(path: Path, width: int):
    from PIL import Image
    import cairosvg

    if not path.is_file():
        raise FileNotFoundError(f"TicketTreat bot brand asset missing: {path.name}")
    data = cairosvg.svg2png(bytestring=path.read_bytes(), output_width=width)
    with Image.open(io.BytesIO(data)) as rendered:
        return rendered.convert("RGBA")


@lru_cache(maxsize=1)
def welcome_photo(language: str = "en") -> bytes:
    """Render the branded 16:9 welcome postcard; language stays in the caption."""
    banner = _render_svg(WELCOME_SVG, 1200)
    output = io.BytesIO()
    banner.convert("RGB").save(output, format="JPEG", quality=93, optimize=True)
    return output.getvalue()


@lru_cache(maxsize=1)
def brand_avatar_jpeg() -> bytes:
    """512px centered ticket logo with dark corners for Telegram circle crop."""
    from PIL import Image

    canvas = Image.new("RGBA", (512, 512), NIGHT)
    canvas.alpha_composite(_render_svg(MARK_SVG, 512))
    output = io.BytesIO()
    canvas.convert("RGB").save(output, format="JPEG", quality=95, optimize=True)
    return output.getvalue()


def send_branded_welcome(bot, chat_id: int, text: str, reply_markup,
                         *, language: str = "en") -> None:
    """Send current logo and localized caption; preserve the Telegram keyboard."""
    try:
        photo = io.BytesIO(welcome_photo(language))
        photo.name = "tickettreat-welcome.jpg"
        if len(text) <= 1024:
            bot.send_photo(chat_id, photo, caption=text, reply_markup=reply_markup)
        else:
            bot.send_photo(chat_id, photo)
            bot.send_message(chat_id, text, reply_markup=reply_markup)
        return
    except Exception as exc:
        print(f"TicketTreat welcome art unavailable ({type(exc).__name__}: {exc})", flush=True)
    bot.send_message(chat_id, text, reply_markup=reply_markup)


def update_bot_avatar(bot_token: str, photo_file: Path | None = None) -> bool:
    """One-shot official Bot API profile photo update after verifying bot ID."""
    if not bot_token:
        return False
    try:
        response = requests.get(f"https://api.telegram.org/bot{bot_token}/getMe", timeout=10)
        body = response.json() if response.status_code == 200 else {}
        if not body.get("ok") or (body.get("result") or {}).get("username", "").casefold() != "tickettreatbot":
            print("TicketTreat avatar update skipped: different bot identity", flush=True)
            return False
    except (requests.RequestException, ValueError):
        print("TicketTreat avatar update skipped: identity verification unavailable", flush=True)
        return False

    try:
        if photo_file is not None:
            from PIL import Image
            with Image.open(photo_file) as img:
                output = io.BytesIO()
                img.convert("RGB").resize((512, 512)).save(output, format="JPEG", quality=95)
                photo = output.getvalue()
        else:
            photo = brand_avatar_jpeg()
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setMyProfilePhoto",
            data={"photo": json.dumps({"type": "static", "photo": "attach://avatar"})},
            files={"avatar": ("tickettreat-avatar.jpg", io.BytesIO(photo), "image/jpeg")},
            timeout=20,
        )
        if response.status_code == 200 and response.json().get("ok") is True:
            print("TicketTreat uploaded-archive mark avatar successfully updated", flush=True)
            return True
        print(f"TicketTreat avatar update unsuccessful (HTTP {response.status_code})", flush=True)
    except (requests.RequestException, ValueError, OSError, ImportError) as exc:
        print(f"TicketTreat avatar update unavailable ({type(exc).__name__}: {exc})", flush=True)
    return False


def apply_avatar_on_startup() -> None:
    # Intentional one-shot operation, never on routine webhook restarts.
    if os.getenv("TICKETTREAT_APPLY_BOT_PHOTO", "").strip() == "1":
        update_bot_avatar(os.getenv("BOT_TOKEN", "").strip())
