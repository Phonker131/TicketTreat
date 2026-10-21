"""Standalone tests: python -m unittest discover -s tests"""
import hashlib
import hmac
import json
import sys
import unittest
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))
from miniapp_auth import MiniAppAuthError, validate_init_data

TOKEN = "test:secret"
NOW = 1800000000


def signed_data(user=None, auth_date=NOW):
    fields = {
        "auth_date": str(auth_date),
        "user": json.dumps(user or {"id": 42, "first_name": "Test"}, separators=(",", ":")),
    }
    key = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    fields["hash"] = hmac.new(key, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


class TelegramMiniAppAuthTests(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(validate_init_data(signed_data(), TOKEN, now=NOW)["id"], 42)

    def test_tampered_id(self):
        data = signed_data().replace("%22id%22%3A42", "%22id%22%3A43")
        with self.assertRaises(MiniAppAuthError):
            validate_init_data(data, TOKEN, now=NOW)

    def test_expired(self):
        with self.assertRaises(MiniAppAuthError):
            validate_init_data(signed_data(auth_date=NOW - 4000), TOKEN, now=NOW)

    def test_missing_user(self):
        with self.assertRaises(MiniAppAuthError):
            validate_init_data("", TOKEN, now=NOW)

    def test_duplicate_field(self):
        with self.assertRaises(MiniAppAuthError):
            validate_init_data(signed_data() + "&auth_date=123", TOKEN, now=NOW)


if __name__ == "__main__":
    unittest.main()
