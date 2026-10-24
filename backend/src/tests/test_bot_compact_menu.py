"""Regression tests for minimal Telegram reply keyboards (no bot token/network)."""
import ast
import pathlib
import time
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[3] / "bot" / "src" / "main.py"


class Button:
    def __init__(self, text, **kwargs):
        self.text=text
        self.kwargs=kwargs


class Keyboard:
    def __init__(self, **kwargs):
        self.keyboard=[]
    def row(self, *buttons):
        self.keyboard.append(list(buttons))


class MenuTests(unittest.TestCase):
    def setUp(self):
        tree=ast.parse(SOURCE.read_text(encoding="utf-8"))
        funcs=[x for x in tree.body if isinstance(x,ast.FunctionDef)
               and x.name in {"menu_profile_complete", "get_main_menu"}]
        self.calls=[]
        status={100:True,101:False,102:True}
        def api(method,path,timeout):
            self.calls.append(path)
            return {"complete":status[int(path.split("/")[-1])]}
        self.scope={"time":time,"backend_request":api,
                    "_menu_registration_cache":{},"MENU_REGISTRATION_TTL_SECONDS":90,
                    "ReplyKeyboardMarkup":Keyboard,"KeyboardButton":Button,
                    "is_admin":lambda i:i==102}
        exec(compile(ast.Module(body=funcs,type_ignores=[]),str(SOURCE),"exec"),
             self.scope)

    def labels(self,user_id):
        return [[b.text for b in row] for row in
                self.scope["get_main_menu"](user_id).keyboard]

    def test_registered_user_no_start_or_duplicate_mini_app(self):
        labels=self.labels(100)
        self.assertEqual(labels,[
            ["📅 Events","🎟 My tickets"],
            ["👤 My profile","🏅 Passport"],
            ["🆘 Client service"]])
        self.assertNotIn("🏠 Start",sum(labels,[]))
        self.assertNotIn("🌐 TicketTreat Mini App",sum(labels,[]))

    def test_new_user_keeps_start_and_explicit_registration(self):
        labels=self.labels(101)
        self.assertEqual(labels,[
            ["🏠 Start","📅 Events"],
            ["📝 Registration","🆘 Client service"]])

    def test_passport_is_exposed_only_to_registered_users(self):
        self.assertIn("🏅 Passport",sum(self.labels(100),[]))
        self.assertNotIn("🏅 Passport",sum(self.labels(101),[]))

    def test_passport_button_reuses_existing_command(self):
        import types
        tree=ast.parse(SOURCE.read_text(encoding="utf-8"))
        handler=next(node for node in tree.body if isinstance(node,ast.FunctionDef)
                     and node.name=="passport_button")
        handler.decorator_list=[]
        calls=[]
        scope={"open_loyalty_passport":lambda message:calls.append(message)}
        exec(compile(ast.Module(body=[handler],type_ignores=[]),str(SOURCE),"exec"),scope)
        msg=types.SimpleNamespace(text="🏅 Passport")
        scope["passport_button"](msg)
        self.assertEqual(calls,[msg])

    def test_admin_keeps_separate_action(self):
        labels=self.labels(102)
        self.assertEqual(labels[-1],["⚙️ Admin"])
        self.assertNotIn("🏠 Start",sum(labels,[]))

    def test_menu_uses_cached_registration_to_avoid_per_message_api_calls(self):
        self.labels(100)
        self.labels(100)
        self.labels(100)
        self.assertEqual(self.calls,["/profile/100"])

if __name__=="__main__":
    unittest.main()
