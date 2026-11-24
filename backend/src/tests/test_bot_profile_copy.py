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
        for lang in ("en","cs"):
            copy=module.get_copy(lang)
            self.assertLessEqual(len(copy["description"]),512)
            self.assertLessEqual(len(copy["about"]),120)
            self.assertEqual([cmd for cmd,_ in copy["commands"]],baseline)
            self.assertEqual(len(copy["buttons"]),2)
            self.assertTrue(copy["start_actions"])
            self.assertIn("Akce" if lang == "cs" else "Events",copy["start"])
            self.assertIn("Moje vstupenky" if lang == "cs" else "My tickets",copy["start"])
            self.assertIn("TicketTreat",copy["description"])

    def test_source_copy_exact_start(self):
        en=module.welcome_text("en","Alex")
        cs=module.welcome_text("cs","Petr")
        self.assertTrue(en.startswith("Hi, Alex! Tap Events"))
        self.assertTrue(cs.startswith("Ahoj, Petr! Klepni na Akce"))
        self.assertTrue(en.endswith("show the QR code at the door."))
        self.assertTrue(module.welcome_text("ru","Alex").startswith("Hi, Alex!"))


    def test_copy_send_uses_safe_app_buttons_and_localized_text(self):
        import ast
        import types
        source=PATH.parent.joinpath("main.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        helpers=[node for node in tree.body if isinstance(node,ast.FunctionDef)
                 and node.name in {"copy_webapp_button", "bot_copy_keyboard", "copy_send"}]
        class Keyboard:
            def __init__(self):
                self.rows=[]
            def add(self,*buttons):
                self.rows.append(list(buttons))
        class Bot:
            def __init__(self):
                self.sent=[]
            def send_message(self,chat_id,text,reply_markup=None):
                self.sent.append((chat_id,text,reply_markup))
        bot=Bot()
        scope={
            "WEB_APP_URL":"https://tickettreat.eu",
            "InlineKeyboardMarkup":Keyboard,
            "InlineKeyboardButton":lambda label,**kwargs:types.SimpleNamespace(label=label,**kwargs),
            "WebAppInfo":lambda url:types.SimpleNamespace(url=url),
            "preserve_custom":lambda text:text,
            "bot":bot,
        }
        exec(compile(ast.Module(body=helpers,type_ignores=[]),str(PATH.parent/"main.py"),"exec"),scope)
        for language in ("en","cs"):
            for chat_type in ("private","supergroup"):
                bot.sent.clear()
                message=types.SimpleNamespace(chat=types.SimpleNamespace(id=17,type=chat_type))
                copy=module.get_copy(language)
                scope["copy_send"](message,copy["start_actions"],[(copy["buttons"][0],"/"),(copy["buttons"][1],"/tickets")])
                self.assertEqual(len(bot.sent),1)
                chat_id,text,markup=bot.sent[0]
                self.assertEqual((chat_id,text),(17,copy["start_actions"]))
                self.assertEqual(len(markup.rows),2)
                for index,route in enumerate(("/","/tickets")):
                    button=markup.rows[index][0]
                    self.assertEqual(button.label,copy["buttons"][index])
                    self.assertEqual((button.web_app.url if chat_type=="private" else button.url),"https://tickettreat.eu"+route)
        scope["WEB_APP_URL"]="http://localhost:3000"
        bot.sent.clear()
        scope["copy_send"](
            types.SimpleNamespace(chat=types.SimpleNamespace(id=17,type="private")),
            module.get_copy("en")["start_actions"],[("Show events","/")],
        )
        self.assertEqual(bot.sent[0][2],None)

    def test_start_preserves_bottom_menu_with_branded_welcome(self):
        import ast
        import types
        source=PATH.parent.joinpath("main.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef)
                and node.name=="start")
        fn.decorator_list=[]
        sent=[]
        menu=object()
        scope={
            "remember_telegram_language":lambda user:"cs",
            "get_copy":module.get_copy,
            "welcome_text":module.welcome_text,
            "preserve_custom":lambda text:text,
            "get_main_menu":lambda user_id, **_kwargs:menu,
            "bot":types.SimpleNamespace(send_message=lambda *a,**kw:sent.append((a,kw))),
        }
        exec(compile(ast.Module(body=[fn],type_ignores=[]),str(PATH.parent/"main.py"),"exec"),scope)
        message=types.SimpleNamespace(
            text="/start",
            chat=types.SimpleNamespace(id=17,type="private"),
            from_user=types.SimpleNamespace(id=42,first_name="Алексей"),
        )
        import sys
        from unittest.mock import patch
        fake_media=types.SimpleNamespace(send_branded_welcome=lambda *args,**kw:sent.append((args,kw)))
        with patch.dict(sys.modules, {"brand_avatar":fake_media}):
            scope["start"](message)
        self.assertEqual(len(sent),1)
        self.assertIs(sent[0][0][3],menu)
        self.assertIn("Ahoj, Алексей!",sent[0][0][2])
        self.assertEqual(sent[0][1]["language"],"cs")

    def test_telegram_auto_locale_and_explicit_fallback(self):
        self.assertEqual(module.normalize_language("cs-CZ"),"cs")
        self.assertEqual(module.normalize_language("uk_UA"),"en")
        self.assertEqual(module.normalize_language("ru"),"en")
        self.assertEqual(module.normalize_language("be"),"en")
        self.assertTrue(module.welcome_text("uk","Olena").startswith("Hi, Olena!"))
        self.assertTrue(module.welcome_text("cs","Petra").startswith("Ahoj, Petra!"))

    def test_disallow_control_chars_in_names(self):
        text=module.welcome_text("cs","Jana\r\nHi")
        self.assertTrue(text.startswith("Ahoj, Jana Hi!"))
        self.assertNotIn("\r",text)

    def test_first_telegram_locale_is_persisted_but_explicit_setting_wins(self):
        import ast
        import types
        source=PATH.parent.joinpath("main.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef)
                and node.name=="remember_telegram_language")
        seen=[]
        explicit=False
        def backend(method,path,**kwargs):
            seen.append((method,kwargs.get("json")))
            if method=="GET":
                return {"explicit":explicit,"language":"ru"}
            return {"language":kwargs["json"]["language"]}
        context={
            "user_language_cache":{},
            "normalize_language":module.normalize_language,
            "SUPPORTED_INTERFACE_LANGUAGES":("en","cs"),
            "backend_request":backend,
        }
        exec(compile(ast.Module(body=[fn],type_ignores=[]),str(PATH.parent/"main.py"),"exec"),context)
        user=types.SimpleNamespace(id=12345,language_code="cs-CZ")
        self.assertEqual(context["remember_telegram_language"](user),"cs")
        self.assertEqual(seen,[("GET",None),("PUT",{"language":"cs"})])
        self.assertEqual(context["remember_telegram_language"](user),"cs")
        self.assertEqual(len(seen),2)
        explicit=True
        context["user_language_cache"].clear()
        seen.clear()
        self.assertEqual(context["remember_telegram_language"](user),"en")
        self.assertEqual(seen,[("GET",None),("PUT",{"language":"en"})])

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
                if field:
                    current=self.reads.get((field,language),[] if field=="commands" else "")
                    return Response(current if field=="commands" else {field:current})
                if endpoint=="deleteMyCommands":
                    self.reads[("commands",language)]=[]
                    self.writes.append(("deleteMyCommands",language))
                    return Response(True)
                field={"setMyDescription":"description","setMyShortDescription":"short_description",
                    "setMyCommands":"commands"}[endpoint]
                self.reads[(field,language)]=json[field]
                self.writes.append((field,language))
                return Response(True)
        fake=Fake()
        module.configure_botfather_profile("fake_token",fake)
        self.assertEqual(len(fake.writes),15)
        module.configure_botfather_profile("fake_token",fake)
        self.assertEqual(len(fake.writes),21)
        self.assertIn(("deleteMyCommands","uk"),fake.writes)
        self.assertIn(("short_description","cs"),fake.writes)

if __name__=="__main__":
    unittest.main()
