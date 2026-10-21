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


if __name__ == "__main__":
    unittest.main()
