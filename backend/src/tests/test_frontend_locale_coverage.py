"""Regression checks for TicketTreat's four-language organizer UI.

Read-only: no browser, database, Telegram credentials or network.
"""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
SCREENS = (
    "AdminEventClient.tsx",
    "AdminClient.tsx",
    "SiteContentClient.tsx",
    "CheckInClient.tsx",
)


class AdminLocaleCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        extra = (FRONTEND / "lib/event-admin-i18n.ts").read_text(encoding="utf-8")
        match = re.search(
            r"const messages: Array<\[string,string,string,string\]> = (\[[\s\S]*?\]);\nconst dictionary",
            extra,
        )
        assert match, "Event/admin translation dictionary missing"
        rows = json.loads(match.group(1))
        cls.translations = {}
        for row in rows:
            assert len(row) == 4
            key, en, cs, uk = row
            assert key not in cls.translations, f"Duplicate translation: {key}"
            cls.translations[key] = {"ru": key, "en": en, "cs": cs, "uk": uk}
        admin = (FRONTEND / "lib/admin-i18n.ts").read_text(encoding="utf-8")
        base_match = re.search(
            r"const translations:[\s\S]*? =\s*(\{[\s\S]*?\});\n\nexport function",
            admin,
        )
        assert base_match, "Admin dictionary missing"
        cls.translations.update({
            k: {**{"ru": k}, **v}
            for k, v in json.loads(base_match.group(1)).items()
            if k not in cls.translations
        })

    def test_every_literal_organizer_translation_has_four_locales(self):
        for filename in SCREENS:
            with self.subTest(screen=filename):
                source = (FRONTEND / "components" / filename).read_text(encoding="utf-8")
                keys = set(re.findall(r'\btr\("([^"\n]+)"\)', source))
                self.assertTrue(keys)
                missing = sorted(keys - self.translations.keys())
                self.assertEqual(missing, [], f"Untranslated labels in {filename}")
                for key in keys:
                    value = self.translations[key]
                    for locale in ("en", "cs", "uk"):
                        self.assertTrue(value.get(locale), f"{filename}: {key!r} missing {locale}")

    def test_english_and_czech_are_free_of_accidental_cyrillic(self):
        for source, options in self.translations.items():
            for locale in ("en", "cs"):
                text = options.get(locale, "")
                self.assertNotRegex(
                    text, r"[\u0400-\u052f]",
                    f"{locale} translation unexpectedly Cyrillic for {source!r}",
                )

    def test_main_admin_event_form_has_no_raw_russian_jsx_labels(self):
        for filename in ("AdminEventClient.tsx", "SiteContentClient.tsx", "CheckInClient.tsx"):
            with self.subTest(screen=filename):
                source = (FRONTEND / "components" / filename).read_text(encoding="utf-8")
                # Text nodes that bypass tr(...) stay Russian regardless of chosen locale.
                raw_text = re.findall(r">\s*([^<>{\n]*[\u0400-\u04ff][^<>{\n]*)<", source)
                self.assertEqual([text.strip() for text in raw_text], [])
                self.assertNotRegex(
                    source,
                    r'(?:placeholder|aria-label|alt)="[^"\n]*[\u0400-\u04ff]',
                )


if __name__ == "__main__":
    unittest.main()
