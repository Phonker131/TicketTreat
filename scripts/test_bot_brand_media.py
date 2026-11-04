"""No-token regression test for approved TicketTreat Telegram brand artwork."""
from io import BytesIO
from pathlib import Path
import hashlib
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bot" / "src"))
import brand_avatar


def inspect_jpeg(data: bytes, dimensions: tuple[int, int]) -> None:
    assert data.startswith(bytes.fromhex("ffd8")), "Expected JPEG"
    with Image.open(BytesIO(data)) as image:
        assert image.format == "JPEG"
        assert image.size == dimensions
        image.verify()


def main() -> None:
    assert brand_avatar.MARK_SVG.parent == ROOT / "bot" / "assets"
    assert brand_avatar.MARK_SVG.is_file()
    assert brand_avatar.WORDMARK_SVG.is_file()
    assert brand_avatar.WELCOME_SVG.is_file()
    assert 'viewBox="0 0 1200 675"' in brand_avatar.WELCOME_SVG.read_text()
    # Avatar and wordmark remain the exact supplied archive originals.
    assert hashlib.sha256(brand_avatar.MARK_SVG.read_bytes()).hexdigest() == (
        "45c67d5e5090864d612af38db0a431dd3ed012527c02e8243d579f79f46877d3"
    )
    assert hashlib.sha256(brand_avatar.WORDMARK_SVG.read_bytes()).hexdigest() == (
        "a08a1cb9dd083a3f2bfd6900ba6fb0a6239881e09d31133a08b799eb85fd5977"
    )
    welcome = brand_avatar.welcome_photo("en")
    assert welcome == brand_avatar.welcome_photo("cs"), "Text stays in translated caption"
    inspect_jpeg(welcome, (1200, 675))
    with Image.open(BytesIO(welcome)) as banner:
        rgb = banner.convert("RGB")
        # The /start image must be the branded postcard, not the former
        # almost-black wordmark splash.
        r, g, b = rgb.getpixel((0, 0))
        assert min(r, g, b) > 220, "Expected light cream background"
        r, g, b = rgb.getpixel((600, 180))
        assert b > r + 55, "Expected centered blue TicketTreat mark"
        r, g, b = rgb.getpixel((1190, 20))
        assert r > b + 70, "Expected coral top-right accent"
        r, g, b = rgb.getpixel((20, 610))
        assert b > r + 60, "Expected blue lower-left accent"

    avatar = brand_avatar.brand_avatar_jpeg()
    inspect_jpeg(avatar, (512, 512))
    with Image.open(BytesIO(avatar)) as face:
        rgb = face.convert("RGB")
        r, g, b = rgb.getpixel((0, 0))
        assert r < 10 and g < 15 and b < 20, "Rounded corners preserve night background"
        r, g, b = rgb.getpixel((90, 90))
        assert b > r + 60, "Blue ticket logo should remain visible"

    class FakeBot:
        def __init__(self):
            self.photo = None
            self.caption = None
            self.markup = None
        def send_photo(self, chat_id, photo, caption=None, reply_markup=None):
            assert chat_id == 1
            self.photo = photo.read()
            self.caption = caption
            self.markup = reply_markup
        def send_message(self, *a, **kw):
            raise AssertionError("Unexpected fallback to text")

    bot = FakeBot()
    brand_avatar.send_branded_welcome(bot, 1, "Hi!", "keyboard", language="cs")
    assert bot.photo == welcome
    assert bot.caption == "Hi!"
    assert bot.markup == "keyboard"
    print("Telegram welcome postcard, official avatar and localized captions verified.")


if __name__ == "__main__":
    main()
