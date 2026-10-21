"""Telegram initData verification: signed, tampered, expired and forged identities."""
import hashlib
import hmac
import json
import unittest
from urllib.parse import urlencode
from fastapi import HTTPException
from demo_telegram import verified_telegram_user


def signed_data(user, timestamp=1_900_000_000, token="test:BOT_TOKEN"):
    fields = {"auth_date": str(timestamp), "user": json.dumps(user, separators=(",", ":"))}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


class TelegramSecurityTests(unittest.TestCase):
    def test_valid(self):
        data = signed_data({"id": 1234567, "first_name": "Test", "username": "hello"})
        user = verified_telegram_user(data, "test:BOT_TOKEN", now=1_900_000_005)
        self.assertEqual(user["id"], 1234567)

    def test_forged_user(self):
        data = signed_data({"id": 1234567, "first_name": "Test"})
        with self.assertRaises(HTTPException) as case:
            verified_telegram_user(data.replace("1234567", "1234568"), "test:BOT_TOKEN", now=1_900_000_005)
        self.assertEqual(case.exception.status_code, 401)

    def test_wrong_bot(self):
        with self.assertRaises(HTTPException):
            verified_telegram_user(signed_data({"id": 1, "first_name": "T"}), "different:BOT", now=1_900_000_005)

    def test_expired(self):
        with self.assertRaises(HTTPException):
            verified_telegram_user(signed_data({"id": 1, "first_name": "T"}), "test:BOT_TOKEN", now=1_900_200_000)

    def test_future(self):
        with self.assertRaises(HTTPException):
            verified_telegram_user(signed_data({"id": 1, "first_name": "T"}), "test:BOT_TOKEN", now=1_899_999_900)

    def test_no_bot_configuration(self):
        with self.assertRaises(HTTPException) as case:
            verified_telegram_user("initData", "", now=1_900_000_000)
        self.assertEqual(case.exception.status_code, 503)


    def test_ticket_notice_is_sent_by_bot_without_exposing_qr_secret(self):
        import os
        import json
        from unittest.mock import patch
        from demo_telegram import send_miniapp_ticket_notice
        with patch.dict(os.environ, {
            "TELEGRAM_MINIAPP_BOT_TOKEN": "test:BOT_TOKEN",
            "WEB_APP_URL": "https://crowdly.example",
        }), patch("demo_telegram.urllib.request.urlopen") as post:
            post.return_value.__enter__.return_value.status = 200
            send_miniapp_ticket_notice(12345, "Fun <Night>", 42, True, "en")
            self.assertEqual(post.call_count, 1)
            request = post.call_args.args[0]
            data = json.loads(request.data.decode("utf-8"))
            self.assertEqual(data["chat_id"], 12345)
            self.assertIn("Fun &lt;Night&gt;", data["text"])
            self.assertIn("Free ticket", data["text"])
            self.assertEqual(
                data["reply_markup"]["inline_keyboard"][0][0]["web_app"]["url"],
                "https://crowdly.example/tickets/42",
            )
            self.assertNotIn("qr_token", data["text"])

    def test_ticket_notice_requires_private_server_configuration(self):
        import os
        from unittest.mock import patch
        from demo_telegram import send_miniapp_ticket_notice
        with patch.dict(os.environ, {
            "TELEGRAM_MINIAPP_BOT_TOKEN": "",
            "WEB_APP_URL": "https://crowdly.example",
        }), patch("demo_telegram.urllib.request.urlopen") as post:
            send_miniapp_ticket_notice(1, "Test", 3, False, "ru")
            post.assert_not_called()



if __name__ == "__main__":
    unittest.main()
