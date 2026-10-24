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
            self.assertTrue(copy["start_actions"])
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


    def test_start_shortcuts_are_localized_and_link_to_correct_pages(self):
        import ast
        import types
        source=PATH.parent.joinpath("main.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        helper=next(node for node in tree.body if isinstance(node,ast.FunctionDef)
                    and node.name=="send_start_shortcuts")
        class Keyboard:
            def __init__(self,row_width=1):
                self.row_width=row_width
                self.rows=[]
            def row(self,*buttons):
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
            "copy_webapp_button":lambda label,route,*,private=True: (label,route,private),
            "preserve_custom":lambda text:text,
            "bot":bot,
        }
        exec(compile(ast.Module(body=[helper],type_ignores=[]),str(PATH.parent/"main.py"),"exec"),scope)
        for language in ("en","ru","cs","uk"):
            for chat_type in ("private","supergroup"):
                bot.sent.clear()
                message=types.SimpleNamespace(chat=types.SimpleNamespace(id=17,type=chat_type))
                copy=module.get_copy(language)
                scope["send_start_shortcuts"](message,copy)
                self.assertEqual(len(bot.sent),1)
                chat_id,text,markup=bot.sent[0]
                self.assertEqual((chat_id,text),(17,copy["start_actions"]))
                self.assertEqual(markup.row_width,2)
                self.assertEqual(markup.rows,[[
                    (copy["buttons"][0],"/",chat_type=="private"),
                    (copy["buttons"][1],"/tickets",chat_type=="private"),
                ]])
        scope["WEB_APP_URL"]="http://localhost:3000"
        bot.sent.clear()
        scope["send_start_shortcuts"](
            types.SimpleNamespace(chat=types.SimpleNamespace(id=17,type="private")),
            module.get_copy("en"),
        )
        self.assertEqual(bot.sent,[])

    def test_start_preserves_bottom_menu_and_adds_shortcuts(self):
        import ast
        import types
        source=PATH.parent.joinpath("main.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef)
                and node.name=="start")
        fn.decorator_list=[]
        sent=[]
        shortcuts=[]
        menu=object()
        scope={
            "remember_telegram_language":lambda user:"ru",
            "get_copy":module.get_copy,
            "welcome_text":module.welcome_text,
            "preserve_custom":lambda text:text,
            "get_main_menu":lambda user_id:menu,
            "send_start_shortcuts":lambda message,copy:shortcuts.append((message,copy)),
            "bot":types.SimpleNamespace(send_message=lambda *a,**kw:sent.append((a,kw))),
        }
        exec(compile(ast.Module(body=[fn],type_ignores=[]),str(PATH.parent/"main.py"),"exec"),scope)
        message=types.SimpleNamespace(
            text="/start",
            chat=types.SimpleNamespace(id=17,type="private"),
            from_user=types.SimpleNamespace(id=42,first_name="Алексей"),
        )
        scope["start"](message)
        self.assertEqual(len(sent),1)
        self.assertEqual(sent[0][1]["reply_markup"],menu)
        self.assertIn("Привет, Алексей!",sent[0][0][1])
        self.assertEqual(shortcuts,[(message,module.get_copy("ru"))])

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
        self.assertEqual(context["remember_telegram_language"](user),"ru")
        self.assertEqual(seen,[("GET",None)])

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
