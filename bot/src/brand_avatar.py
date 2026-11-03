"""TicketTreat bot identity and welcome media use the website's actual PWA icon.

The source of truth is frontend/public/app-icon-256.png, the same file served
by frontend/lib/brand-image.tsx at /brand/icon/{size}. The icon must
match the live blue site version rather than the stale red release asset.
Keep interface text
in the localized Telegram caption instead of making a second branded image.
"""
from __future__ import annotations

import io
import json
import os
from functools import lru_cache
from pathlib import Path

import requests

BRAND_ROOT = Path(__file__).resolve().parents[2] / "frontend" / "public"
SITE_ICON = BRAND_ROOT / "app-icon-256.png"


@lru_cache(maxsize=1)
def welcome_photo(language: str = "en") -> bytes:
    """The exact PNG pixels used by the website, irrespective of language."""
    from PIL import Image
    if not SITE_ICON.is_file():
        raise FileNotFoundError("Official TicketTreat app-icon-256.png is missing")
    data = SITE_ICON.read_bytes()
    with Image.open(io.BytesIO(data)) as icon:
        if icon.format != "PNG" or icon.width != icon.height:
            raise ValueError("Official TicketTreat icon must be a square PNG")
        icon.verify()
    return data


@lru_cache(maxsize=1)
def brand_avatar_jpeg() -> bytes:
    """Website icon, centered in a 512px JPEG for Telegram's circular crop."""
    from PIL import Image
    from PIL import ImageOps
    with Image.open(io.BytesIO(welcome_photo())) as source:
        rgba = source.convert("RGBA")
        backdrop = Image.new("RGBA", rgba.size, (240, 235, 225, 255))
        backdrop.alpha_composite(rgba)
        image = backdrop.convert("RGB")
    image = ImageOps.contain(image, (512, 512), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (512, 512), (240, 235, 225))
    canvas.paste(image, ((512 - image.width) // 2, (512 - image.height) // 2))
    result = io.BytesIO()
    canvas.save(result, format="JPEG", quality=95, optimize=True)
    return result.getvalue()


def send_branded_welcome(bot,chat_id:int,text:str,reply_markup,*,language:str="en")->None:
    """Photo+caption preserves the reply keyboard; text fallback never blocks /start."""
    try:
        if len(text)<=1024:
            bot.send_photo(chat_id,io.BytesIO(welcome_photo(language)),
                           caption=text,reply_markup=reply_markup)
        else:
            bot.send_photo(chat_id,io.BytesIO(welcome_photo(language)))
            bot.send_message(chat_id,text,reply_markup=reply_markup)
        return
    except Exception as exc:
        print(f"TicketTreat welcome image unavailable ({type(exc).__name__})",flush=True)
    bot.send_message(chat_id,text,reply_markup=reply_markup)


def update_bot_avatar(bot_token:str,photo_file:Path|None=None)->bool:
    if not bot_token:
        return False
    try:
        me=requests.get(f"https://api.telegram.org/bot{bot_token}/getMe",timeout=10)
        info=me.json() if me.status_code==200 else {}
        if not info.get("ok") or (info.get("result") or {}).get("username","").casefold()!="tickettreatbot":
            print("TicketTreat avatar update skipped: different bot identity",flush=True)
            return False
    except (requests.RequestException,ValueError):
        print("TicketTreat avatar update skipped: identity verification unavailable",flush=True)
        return False
    try:
        if photo_file:
            from PIL import Image
            with Image.open(photo_file) as img:
                out=io.BytesIO()
                img.convert("RGB").resize((512,512)).save(out,format="JPEG",quality=95)
                photo=out.getvalue()
        else:
            photo=brand_avatar_jpeg()
        response=requests.post(
            f"https://api.telegram.org/bot{bot_token}/setMyProfilePhoto",
            data={"photo":json.dumps({"type":"static","photo":"attach://avatar"})},
            files={"avatar":("tickettreat-avatar.jpg",io.BytesIO(photo),"image/jpeg")},
            timeout=20,
        )
        if response.status_code==200 and response.json().get("ok") is True:
            print("TicketTreat website app-icon avatar successfully updated",flush=True)
            return True
        print(f"TicketTreat avatar update unsuccessful (HTTP {response.status_code})",flush=True)
    except (requests.RequestException,ValueError,OSError,ImportError) as exc:
        print(f"TicketTreat avatar update unavailable ({type(exc).__name__}: {exc})",flush=True)
    return False


def apply_avatar_on_startup()->None:
    # Execute only during an explicitly flagged deployment; do not rewrite
    # Telegram's profile image on every bot/webhook restart.
    if os.getenv("TICKETTREAT_APPLY_BOT_PHOTO","").strip()=="1":
        update_bot_avatar(os.getenv("BOT_TOKEN","").strip())
