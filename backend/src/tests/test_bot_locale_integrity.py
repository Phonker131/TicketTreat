"""Static, token-free regression tests for TicketTreat Telegram localization."""
import ast
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[3] / "bot" / "src" / "main.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))
LANGUAGES = ("en", "cs", "ru", "uk")


def translated_strings():
    found = {}
    for node in ast.walk(TREE):
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values):
                if (isinstance(key, ast.Constant) and isinstance(key.value, str)
                        and isinstance(value, ast.Call)
                        and isinstance(value.func, ast.Name) and value.func.id == "_tr"
                        and len(value.args) == 4
                        and all(isinstance(arg, ast.Constant) for arg in value.args)):
                    found[key.value] = dict(zip(LANGUAGES, [arg.value for arg in value.args]))
    return found


def function(name):
    return next(node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name == name)


class BotLocaleIntegrityTests(unittest.TestCase):
    def test_four_complete_locales(self):
        catalog = translated_strings()
        self.assertGreaterEqual(len(catalog), 270)
        for key, values in catalog.items():
            with self.subTest(key=key):
                self.assertEqual(set(values), set(LANGUAGES))
                self.assertTrue(all(isinstance(v, str) and v for v in values.values()))
                for lang in ("en", "cs"):
                    self.assertFalse(any("\u0400" <= c <= "\u052f" for c in values[lang]))

    def test_legacy_payment_and_profile_prompts_have_translations(self):
        catalog = translated_strings()
        required = [
            "💳 Для завершения регистрации оплати билет по реквизитам ниже:",
            "⏳ Администратор должен подтвердить оплату в течение 24 часов.",
            "Крайний срок подтверждения: ",
            "Если оплата не будет подтверждена вовремя, бронь автоматически отменится.",
            "Пример: 2026-09-01 18:30",
            "Comment: имя участника",
            "Напиши skip, если напоминание не нужно.",
            "В профиле пока нет Instagram. Введите Instagram username или ссылку:",
        ]
        for item in required:
            with self.subTest(message=item):
                self.assertIn(item, catalog)

    def test_substitution_is_one_pass(self):
        fn = function("_translate_ui_segment")
        calls = [n for n in ast.walk(fn) if isinstance(n, ast.Call)]
        self.assertTrue(any(isinstance(n.func, ast.Attribute) and n.func.attr == "sub" for n in calls))
        self.assertFalse(any(isinstance(n.func, ast.Attribute) and n.func.attr == "replace" for n in calls))

    def test_locale_is_persisted_and_unsupported_telegram_locale_has_fallback(self):
        get_language = ast.get_source_segment(SOURCE.read_text(encoding="utf-8"), function("get_interface_language"))
        remember = ast.get_source_segment(SOURCE.read_text(encoding="utf-8"), function("remember_telegram_language"))
        self.assertIn('data.get("language") or DEFAULT_INTERFACE_LANGUAGE', get_language)
        self.assertIn('or DEFAULT_INTERFACE_LANGUAGE', remember)
        self.assertIn('normalize_language(result.get("language")) or chosen', remember)

    def test_custom_content_boundaries_are_retained(self):
        src = SOURCE.read_text(encoding="utf-8")
        self.assertIn('_CUSTOM_TEXT_START', ast.get_source_segment(src, function("localize_system_text")))
        self.assertIn('preserve_custom(', src)


if __name__ == "__main__":
    unittest.main()
