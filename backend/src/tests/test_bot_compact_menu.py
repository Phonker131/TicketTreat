"""Regression tests for the current minimal Telegram reply keyboard."""
import ast
import pathlib
import unittest
from types import SimpleNamespace

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
               and x.name == "get_main_menu"]
        self.calls=[]
        self.scope={"ReplyKeyboardMarkup":Keyboard,"KeyboardButton":Button,
                    "WebAppInfo":lambda url:SimpleNamespace(url=url),
                    "WEB_APP_URL":"https://tickettreat.eu",
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
            ["🆘 Client service"]])
        self.assertNotIn("🏠 Start",sum(labels,[]))
        self.assertNotIn("🌐 TicketTreat Mini App",sum(labels,[]))
        menu=self.scope["get_main_menu"](100,private=True)
        self.assertEqual(menu.keyboard[0][1].kwargs["web_app"].url,
                         "https://tickettreat.eu/tickets")
        group=self.scope["get_main_menu"](100,private=False)
        self.assertNotIn("web_app",group.keyboard[0][1].kwargs)

    def test_new_user_gets_same_short_menu_without_duplicate_registration(self):
        labels=self.labels(101)
        self.assertEqual(labels,[
            ["📅 Events","🎟 My tickets"],
            ["🆘 Client service"]])

    def test_passport_remains_command_instead_of_bottom_menu_clutter(self):
        self.assertNotIn("🏅 Passport",sum(self.labels(100),[]))
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

    def test_menu_does_not_fetch_account_registration_on_each_open(self):
        self.labels(100)
        self.labels(100)
        self.labels(100)
        self.assertEqual(self.calls,[])

if __name__=="__main__":
    unittest.main()
