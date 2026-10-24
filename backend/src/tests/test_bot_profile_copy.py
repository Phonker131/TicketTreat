"""BotFather copy and command localization, no live Bot API traffic."""
import importlib.util
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[3] / "bot" / "src" / "bot_profile_copy.py"
spec = importlib.util.spec_from_file_location("bot_profile_copy_test", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProfileCopyTests(unittest.TestCase):
    def test_description_about_limits_and_same_commands_everywhere(self):
        module.validate_profile_copy()
        baseline=[command for command,_ in module.get_copy("en")["commands"]]
        self.assertEqual(baseline,["events","tickets","passport","reminders","help"])
        for lang in ("en","ru","cs","uk"):
            copy=module.get_copy(lang)
            self.assertLessEqual(len(copy["description"]),512)
            self.assertLessEqual(len(copy["about"]),120)
            self.assertEqual([cmd for cmd,_ in copy["commands"]],baseline)
            self.assertEqual(len(copy["buttons"]),2)
            self.assertIn("/passport",copy["start"])
            self.assertIn("/tickets",copy["start"])
            self.assertIn("TicketTreat",copy["description"])

    def test_source_copy_exact_start(self):
        en=module.welcome_text("en","Alex")
        ru=module.welcome_text("ru","Александр")
        self.assertTrue(en.startswith("Hi, Alex! This is TicketTreat."))
        self.assertTrue(ru.startswith("Привет, Александр! Это TicketTreat."))
        self.assertTrue(en.endswith('Pick an event, tap "Book a spot" and your ticket arrives here.'))
        self.assertTrue(ru.endswith("Выбери ивент, нажми «Записаться» — билет придёт сюда."))

    def test_telegram_auto_locale_and_explicit_fallback(self):
        self.assertEqual(module.normalize_language("cs-CZ"),"cs")
        self.assertEqual(module.normalize_language("uk_UA"),"uk")
        self.assertEqual(module.normalize_language("ru"),"ru")
        self.assertEqual(module.normalize_language("be"),"en")
        self.assertTrue(module.welcome_text("uk","Олена").startswith("Привіт, Олена!"))
        self.assertTrue(module.welcome_text("cs","Petra").startswith("Ahoj, Petra!"))

    def test_disallow_control_chars_in_names(self):
        text=module.welcome_text("cs","Jana\r\nHi")
        self.assertTrue(text.startswith("Ahoj, Jana Hi!"))
        self.assertNotIn("\r",text)

    def test_idempotent_profile_sync_for_each_language(self):
        class Response:
            ok=True
            def __init__(self, value):self.value=value
            def json(self):return {"ok":True,"result":self.value}
        class Fake:
            def __init__(self):
                self.reads={}
                self.writes=[]
            def post(self, url, json, timeout):
                endpoint=url.split("/")[-1]
                language=json.get("language_code","")
                field={"getMyDescription":"description","getMyShortDescription":"short_description",
                    "getMyCommands":"commands"}.get(endpoint)
                if field:return Response({field:self.reads.get((field,language),[] if field=="commands" else "")})
                field={"setMyDescription":"description","setMyShortDescription":"short_description",
                    "setMyCommands":"commands"}[endpoint]
                self.reads[(field,language)]=json[field]
                self.writes.append((field,language))
                return Response(True)
        fake=Fake()
        module.configure_botfather_profile("fake_token",fake)
        self.assertEqual(len(fake.writes),15)
        module.configure_botfather_profile("fake_token",fake)
        self.assertEqual(len(fake.writes),15)
        self.assertIn(("commands","uk"),fake.writes)
        self.assertIn(("short_description","cs"),fake.writes)

if __name__=="__main__":
    unittest.main()
