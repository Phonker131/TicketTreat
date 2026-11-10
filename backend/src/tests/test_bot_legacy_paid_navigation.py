"""Token-free regression checks for obsolete Telegram payment callbacks.

The unified Mini App must be the only active paid-event registration flow.
Historical callback buttons are kept navigable but never call the legacy API
when TicketTreat web integration is configured.
"""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).resolve().parents[3] / "bot" / "src" / "main.py"


class Button:
    def __init__(self, text, *, web_app=None, url=None, callback_data=None):
        self.text = text
        self.web_app = web_app
        self.url = url
        self.callback_data = callback_data


class Keyboard:
    def __init__(self):
        self.keyboard = []

    def add(self, button):
        self.keyboard.append([button])


class Bot:
    def __init__(self):
        self.messages = []

    def callback_query_handler(self, **_kwargs):
        return lambda fn: fn

    def send_message(self, chat_id, text, **kwargs):
        self.messages.append((chat_id, text, kwargs))


class LegacyPaidNavigationTests(unittest.TestCase):
    def test_payment_info_redirects_to_canonical_event_without_backend_calls(self):
        source = SOURCE.read_text(encoding="utf-8")
        tree = ast.parse(source)
        func = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                    and n.name == "payment_info")
        bot = Bot()
        answers = []

        def forbidden_backend(*_args, **_kwargs):
            self.fail("Old payment callback must not reach legacy payment API")

        namespace = {
            "WEB_APP_URL": "https://tickettreat.eu",
            "InlineKeyboardButton": Button,
            "InlineKeyboardMarkup": Keyboard,
            "WebAppInfo": lambda url: SimpleNamespace(url=url),
            "bot": bot,
            "backend_request": forbidden_backend,
            "answer_callback": lambda *a, **kw: answers.append((a, kw)),
        }
        exec(compile(ast.Module(body=[func], type_ignores=[]),
                     str(SOURCE), "exec"), namespace)
        call = SimpleNamespace(
            data="payment_info:42",
            message=SimpleNamespace(chat=SimpleNamespace(id=101)))
        namespace["payment_info"](call)
        self.assertEqual(len(answers), 1)
        self.assertEqual(len(bot.messages), 1)
        chat_id, message, options = bot.messages[0]
        self.assertEqual(chat_id, 101)
        self.assertIn("TicketTreat", message)
        self.assertEqual(
            options["reply_markup"].keyboard[0][0].web_app.url,
            "https://tickettreat.eu/events/42")

    def test_private_reply_menu_opens_ticket_page_directly(self):
        source = SOURCE.read_text(encoding="utf-8")
        tree = ast.parse(source)
        fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                  and node.name == "get_main_menu")

        class ReplyMenu:
            def __init__(self, **_kwargs):
                self.rows = []
            def row(self, *buttons):
                self.rows.append(buttons)

        namespace = {
            "WEB_APP_URL": "https://tickettreat.eu",
            "ReplyKeyboardMarkup": ReplyMenu,
            "KeyboardButton": Button,
            "WebAppInfo": lambda url: SimpleNamespace(url=url),
            "menu_profile_complete": lambda _id: True,
            "is_admin": lambda _id: False,
        }
        exec(compile(ast.Module(body=[fn], type_ignores=[]), str(SOURCE), "exec"), namespace)
        private = namespace["get_main_menu"](42, private=True)
        self.assertEqual(private.rows[0][1].web_app.url,
                         "https://tickettreat.eu/tickets")
        group = namespace["get_main_menu"](42, private=False)
        self.assertIsNone(group.rows[0][1].web_app)

    def test_legacy_ticket_card_opens_exact_qr_page(self):
        source = SOURCE.read_text(encoding="utf-8")
        tree = ast.parse(source)
        fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                  and node.name == "my_events")
        seen = []
        bot = Bot()
        bot.message_handler = lambda **_kwargs: lambda callback: callback
        namespace = {
            "WEB_APP_URL": "https://tickettreat.eu",
            "bot": bot,
            "backend_request": lambda *_a, **_kw: [{"id": 7, "ticket_id": 42}],
            "InlineKeyboardButton": Button,
            "InlineKeyboardMarkup": Keyboard,
            "WebAppInfo": lambda url: SimpleNamespace(url=url),
            "send_event_card": lambda _chat, _event, reply_markup: seen.append(reply_markup),
        }
        exec(compile(ast.Module(body=[fn], type_ignores=[]), str(SOURCE), "exec"), namespace)
        message = SimpleNamespace(from_user=SimpleNamespace(id=42),
                                  chat=SimpleNamespace(id=42, type="private"))
        namespace["my_events"](message)
        self.assertEqual(len(seen), 1)
        self.assertEqual(seen[0].keyboard[0][0].web_app.url,
                         "https://tickettreat.eu/tickets/42?show=qr")

    def test_outdated_24_hour_mini_app_prompts_are_retired(self):
        source = SOURCE.read_text(encoding="utf-8")
        self.assertNotIn('"⏳ Резерв 24 часа → TicketTreat":', source)
        self.assertNotIn('"⏳ Заявка на оплату — 24 часа":', source)
        self.assertNotIn('Open Mini App to hold a place for 24 hours', source)


if __name__ == "__main__":
    unittest.main()
