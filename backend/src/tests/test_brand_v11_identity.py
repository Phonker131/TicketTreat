"""Brandbook v1.1: validate production identity and four-language navigation contracts."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[3]
FRONTEND=ROOT/"frontend"

class BrandIdentityTests(unittest.TestCase):
    def test_pwa_manifest_uses_night_ink_not_old_paper_or_tomato(self):
        source=(FRONTEND/"app/manifest.ts").read_text(encoding="utf-8")
        self.assertIn('background_color: "#15141F"',source)
        self.assertIn('theme_color: "#15141F"',source)

    def test_footer_has_four_language_organizer_link(self):
        source=(FRONTEND/"components/LegalFooter.tsx").read_text(encoding="utf-8")
        self.assertIn('className="tt-business-footer-link" href="/business"',source)
        for phrase in ("Для организаторов и фирм","Pro pořadatele a firmy",
                       "Для організаторів і компаній","For organizers and businesses"):
            self.assertIn(phrase,source)

    def test_brandbook_palette_is_present_without_extra_named_ink(self):
        css=(FRONTEND/"app/tickettreat-tokens.css").read_text(encoding="utf-8").lower()
        for name,color in {"ink":"#15141f","ink2":"#1e1d2b","ink3":"#2b2a3a",
          "line":"#3a3949","paper":"#f0ebe1","shade":"#e6dfd1",
          "mute":"#a9a6b3","tom":"#ff5533","blu":"#3b4cf0","yel":"#f4b400",
          "plum":"#3b1930","fire":"#f53d00"}.items():
            self.assertRegex(css,rf"--{name}:\s*{color}")

    def test_four_botfather_locales_and_no_emoji_in_main_menu_labels(self):
        import importlib.util
        source=ROOT/"bot/src/bot_profile_copy.py"
        spec=importlib.util.spec_from_file_location("brand_copy",source)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.validate_profile_copy()
        self.assertEqual(set(mod.LANGUAGES),{"en","ru","cs","uk"})
        menu=(ROOT/"bot/src/main.py").read_text(encoding="utf-8")
        self.assertIn('def ui_text_matches(',menu)
        # Display text must pass through four-language translation.
        self.assertIn('localize_system_text(',menu)

if __name__=="__main__":
    unittest.main()
