"""Webhook security regression: no live Telegram requests or production tokens."""
from __future__ import annotations
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

MODULE=Path(__file__).resolve().parents[3]/"bot"/"src"/"webhook_runtime.py"
SPEC=importlib.util.spec_from_file_location("bot_webhook_under_test",MODULE)
runtime=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runtime)
SECRET="test_webhook_secret_at_least_32_characters"
URL="https://example.invalid/telegram/update"


class BotWebhookTests(unittest.TestCase):
    def test_authenticated_update_only_and_no_backlog_drop(self):
        bot=MagicMock()
        bot.set_webhook.return_value=True
        fake_types=types.ModuleType("telebot.types")
        fake_types.Update=type("Update",(),{"de_json":staticmethod(json.loads)})
        fake_telebot=types.ModuleType("telebot")
        fake_telebot.types=fake_types
        with patch.dict(sys.modules,{"telebot":fake_telebot,"telebot.types":fake_types}):
            with TestClient(runtime.webhook_app(bot,url=URL,secret=SECRET)) as client:
                bot.set_webhook.assert_called_once_with(
                    url=URL,secret_token=SECRET,drop_pending_updates=False
                )
                denied=client.post("/telegram/update",json={"update_id":71})
                self.assertEqual(denied.status_code,403)
                bot.process_new_updates.assert_not_called()
                invalid=client.post("/telegram/update",json={"data":"hi"},
                                    headers={"X-Telegram-Bot-Api-Secret-Token":SECRET})
                self.assertEqual(invalid.status_code,400)
                bad=client.post("/telegram/update",data="x"*(runtime.MAX_UPDATE_BYTES+1),
                    headers={"X-Telegram-Bot-Api-Secret-Token":SECRET})
                self.assertEqual(bad.status_code,413)
                valid=client.post("/telegram/update",json={"update_id":71,"message":{}},
                    headers={"X-Telegram-Bot-Api-Secret-Token":SECRET})
                self.assertEqual(valid.status_code,200,valid.text)
                bot.process_new_updates.assert_called_once()
                self.assertEqual(bot.process_new_updates.call_args.args[0],[{"update_id":71,"message":{}}])
                self.assertEqual(client.get("/health").status_code,200)

    def test_invalid_webhook_settings_fail_closed(self):
        bot=MagicMock()
        with self.assertRaises(ValueError):
            runtime.webhook_app(bot,url="http://localhost/telegram/update",secret=SECRET)
        with self.assertRaises(ValueError):
            runtime.webhook_app(bot,url=URL,secret="123")
        with self.assertRaises(ValueError):
            runtime.webhook_app(bot,url=URL,secret="a"*40+"!")

    def test_startup_rejects_failed_telegram_registration(self):
        bot=MagicMock()
        bot.set_webhook.return_value=False
        with self.assertRaises(RuntimeError):
            with TestClient(runtime.webhook_app(bot,url=URL,secret=SECRET)):
                pass

if __name__=="__main__":
    unittest.main()
