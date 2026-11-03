"""TicketTreat bot avatar and /start media from the *official website SVG*.

No duplicate logo assets: both images derive from frontend/public/tickettreat-
mark.svg and tickettreat-wordmark.svg. Keep BotFather avatar updates one-shot,
but the welcome picture is rendered locally and cached in the bot process.
"""
from __future__ import annotations

import io
import json
import os
from functools import lru_cache
from pathlib import Path

import requests

BRAND_ROOT=Path(__file__).resolve().parents[2]/"frontend"/"public"
MARK=BRAND_ROOT/"tickettreat-mark.svg"
WORDMARK=BRAND_ROOT/"tickettreat-wordmark.svg"
PAPER=(240,235,225)
INK=(2,7,10)
ORANGE=(255,85,51)
BLUE=(2,151,222)


def _raster_svg(path:Path, *, output_width:int) -> "Image.Image":
    from PIL import Image
    import cairosvg
    if not path.is_file():
        raise FileNotFoundError(f"TicketTreat brand asset missing: {path.name}")
    png=cairosvg.svg2png(bytestring=path.read_bytes(), output_width=output_width)
    with Image.open(io.BytesIO(png)) as rendered:
        return rendered.convert("RGBA")


def _font(size:int, bold:bool=False):
    from PIL import ImageFont
    options=(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    )
    for path in options:
        if Path(path).is_file():
            return ImageFont.truetype(path,size)
    return ImageFont.load_default()


@lru_cache(maxsize=1)
def brand_avatar_jpeg() -> bytes:
    """Site TT ticket symbol, centered so Telegram's round crop stays legible."""
    from PIL import Image
    canvas=Image.new("RGB",(512,512),INK)
    icon=_raster_svg(MARK,output_width=390)
    canvas.paste(icon,(61,61),icon)
    out=io.BytesIO()
    canvas.save(out,format="JPEG",quality=95,optimize=True)
    return out.getvalue()


@lru_cache(maxsize=2)
def welcome_photo(language:str="en")->bytes:
    """1200x630 photo-safe welcome plate, matching the site wordmark and palette."""
    from PIL import Image,ImageDraw
    lang="cs" if language=="cs" else "en"
    image=Image.new("RGB",(1200,630),INK)
    draw=ImageDraw.Draw(image)
    # The site renders its exact traced logo on paper, never black on dark.
    draw.rounded_rectangle((48,45,1152,585),radius=30,fill=PAPER)
    draw.rounded_rectangle((48,45,1152,69),radius=12,fill=ORANGE)
    logo=_raster_svg(WORDMARK,output_width=780)
    if logo.height>190:
        logo.thumbnail((780,190),Image.Resampling.LANCZOS)
    image.paste(logo,((1200-logo.width)//2,135),logo)
    title="VSTUPENKY NA AKCE V ČESKU" if lang=="cs" else "EVENT TICKETS IN CZECHIA"
    subtitle="Objev akce  •  Rezervuj místo  •  Ukaž QR kód" if lang=="cs" else "Explore events  •  Book a spot  •  Show your QR"
    font=_font(47,True)
    small=_font(30,False)
    draw.text((600,379),title,fill=INK,font=font,anchor="mm")
    draw.text((600,462),subtitle,fill=INK,font=small,anchor="mm")
    draw.rounded_rectangle((503,520,697,534),radius=7,fill=BLUE)
    out=io.BytesIO()
    image.save(out,format="JPEG",quality=91,optimize=True)
    return out.getvalue()


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
            print("TicketTreat brand avatar successfully updated",flush=True)
            return True
        print(f"TicketTreat avatar update unsuccessful (HTTP {response.status_code})",flush=True)
    except (requests.RequestException,ValueError,OSError,ImportError) as exc:
        print(f"TicketTreat avatar update unavailable ({type(exc).__name__})",flush=True)
    return False


def apply_avatar_on_startup()->None:
    # Execute only during an explicitly flagged deployment; do not rewrite
    # Telegram's profile image on every bot/webhook restart.
    if os.getenv("TICKETTREAT_APPLY_BOT_PHOTO","").strip()=="1":
        update_bot_avatar(os.getenv("BOT_TOKEN","").strip())
