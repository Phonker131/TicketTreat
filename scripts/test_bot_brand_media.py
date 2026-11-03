"""CI smoke-test: Telegram uses the same PNG as the live website's PWA icon."""
from io import BytesIO
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "bot" / "src"))
import brand_avatar


def main():
    source = ROOT / "frontend" / "public" / "app-icon-256.png"
    assert brand_avatar.SITE_ICON == source
    assert source.is_file()
    exact = source.read_bytes()
    assert exact.startswith(bytes.fromhex("89504e470d0a1a0a"))
    for language in ("en", "cs"):
        welcome = brand_avatar.welcome_photo(language)
        assert welcome == exact, f"{language}: welcome differs from website icon"
        with Image.open(BytesIO(welcome)) as image:
            assert image.format == "PNG"
            assert image.size == (256, 256)
            # The live site uses the blue TT icon, not the former red one.
            rgb = image.convert("RGB").getpixel((128, 70))
            assert rgb[0] < 60 and 90 < rgb[1] < 210 and rgb[2] > 170, (
                f"{language}: unexpected website icon color: {rgb}"
            )
            image.verify()

    avatar = brand_avatar.brand_avatar_jpeg()
    assert avatar.startswith(bytes.fromhex("ffd8"))
    with Image.open(BytesIO(avatar)) as image:
        assert image.format == "JPEG"
        assert image.size == (512, 512)
        image.verify()
    print("Telegram avatar and CS/EN welcome use the exact website icon.")


if __name__ == "__main__":
    main()
