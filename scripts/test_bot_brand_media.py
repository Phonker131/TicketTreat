"""CI smoke test of actual TicketTreat Telegram artwork (no Bot API traffic)."""
from io import BytesIO
from pathlib import Path
import sys

from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"bot"/"src"))
import brand_avatar


def verify_image(content:bytes, size:tuple[int,int], label:str)->None:
    assert content.startswith(bytes.fromhex("ffd8")),f"{label}: not a JPEG"
    with Image.open(BytesIO(content)) as image:
        assert image.size==size,(label,image.size)
        assert image.format=="JPEG",(label,image.format)
        image.verify()


def main():
    assert brand_avatar.MARK.is_file()
    assert brand_avatar.WORDMARK.is_file()
    verify_image(brand_avatar.brand_avatar_jpeg(),(512,512),"avatar")
    for language in ("en","cs"):
        verify_image(brand_avatar.welcome_photo(language),(1200,630),language)
    print("CS/EN TicketTreat SVG welcome and avatar media validated.")


if __name__=="__main__":
    main()
