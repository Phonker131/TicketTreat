"""Regression checks for the Telegram admin interface's canonical Mini App navigation.

No live Telegram API, database, bot token, or Railway service is contacted.
"""
import ast
import pathlib
import types
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[3] / "bot" / "src" / "main.py"
NAMES = {"legacy_admin_destination", "admin_target_button",
         "admin_dashboard_markup", "require_admin_callback"}


class Button:
    def __init__(self, text, *, web_app=None, url=None, callback_data=None):
        self.text=text
        self.web_app=web_app
        self.url=url
        self.callback_data=callback_data


class Keyboard:
    def __init__(self):
        self.keyboard=[]
    def add(self, button):
        self.keyboard.append([button])


class NavigationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tree=ast.parse(SOURCE.read_text(encoding="utf-8"))
        functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in NAMES]
        scope={
            "WEB_APP_URL":"https://tickettreat.eu",
            "InlineKeyboardButton":Button,
            "InlineKeyboardMarkup":Keyboard,
            "WebAppInfo":lambda url:types.SimpleNamespace(url=url),
            "admin_locale":lambda _:{"dashboard":"Dashboard","analytics":"Analytics",
                "checkin":"QR","broadcast":"Broadcasts","support":"Support"},
            "is_admin":lambda user_id:user_id==77,
            "answer_callback":lambda *_args,**_kwargs:None,
            "redirect_legacy_admin_callback":lambda call:cls.redirected.append(call.data),
        }
        exec(compile(ast.Module(body=functions,type_ignores=[]),str(SOURCE),"exec"),scope)
        cls.scope=scope

    def setUp(self):
        self.__class__.redirected=[]

    def test_old_inline_callbacks_open_the_correct_event_instead_of_legacy_backend(self):
        fn=self.scope["legacy_admin_destination"]
        self.assertEqual(fn("admin:participants:19"),"/admin/events/19")
        self.assertEqual(fn("admin:export_participants:19"),"/admin/events/19")
        self.assertEqual(fn("admin:confirm_payment:19:123"),"/admin/events/19")
        self.assertEqual(fn("admin:edit_field:19:title"),"/admin/events/19")
        self.assertEqual(fn("admin:cancel:19"),"/admin/events/19")
        self.assertEqual(fn("admin:events"),"/admin")
        self.assertEqual(fn("broadcast:event:19"),"/admin/broadcasts")

    def test_private_menu_uses_only_https_mini_app_and_no_legacy_callbacks(self):
        k=self.scope["admin_dashboard_markup"](77,private=True)
        self.assertEqual([x[0].web_app.url for x in k.keyboard],[
            "https://tickettreat.eu/admin",
            "https://tickettreat.eu/admin/analytics",
            "https://tickettreat.eu/admin/check-in",
            "https://tickettreat.eu/admin/broadcasts",
            "https://tickettreat.eu/admin/support"])
        self.assertTrue(all(x[0].callback_data is None for x in k.keyboard))

    def test_group_chat_uses_https_url_not_unsupported_web_app_button(self):
        k=self.scope["admin_dashboard_markup"](77,private=False)
        self.assertTrue(all(b[0].web_app is None for b in k.keyboard))
        self.assertTrue(all(b[0].url.startswith("https://tickettreat.eu/") for b in k.keyboard))

    def test_legacy_callbacks_never_reach_the_old_handlers(self):
        guard=self.scope["require_admin_callback"]
        for action in ["admin:participants:19","admin:confirm_payment:19:12",
                       "admin:add_event","admin:cancel:19",
                       "admin:edit:19","broadcast:start:text",
                       "broadcast:audience:all"]:
            self.assertFalse(guard(types.SimpleNamespace(
                from_user=types.SimpleNamespace(id=77),data=action)))
        self.assertEqual(len(self.redirected),7)
        self.assertFalse(guard(types.SimpleNamespace(
            from_user=types.SimpleNamespace(id=99),data="admin:participants:19")))
        self.assertEqual(len(self.redirected),7)


if __name__=="__main__":
    unittest.main()
