"""Offline checks for TicketTreat's versioned disposable-domain policy."""
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from demo_disposable_email import (
    _bundled_domains,
    is_disposable_email,
    require_signup_email_allowed,
)


class DisposableEmailTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "SIGNUP_EMAIL_DOMAIN_BLOCKLIST_EXTRA": "",
            "SIGNUP_EMAIL_DOMAIN_ALLOWLIST": "",
        })
        self.environment.start()

    def tearDown(self):
        self.environment.stop()

    def test_known_temporary_providers_and_subdomains(self):
        for email in (
            "ttqa20261125@euploading.com",
            "ttorg20261125@EUPLOADING.COM",
            "person@mail.tm",
            "person@sub.mail.tm",
            "person@euploading.com.",
        ):
            with self.subTest(email=email):
                self.assertTrue(is_disposable_email(email))
                with self.assertRaises(HTTPException) as error:
                    require_signup_email_allowed(email)
                self.assertEqual(error.exception.status_code, 422)
                self.assertEqual(error.exception.detail, "disposable_email_not_allowed")

    def test_real_and_lookalike_domains_are_allowed(self):
        for email in (
            "guest@gmail.com", "guest@seznam.cz", "guest@outlook.com",
            "guest@icloud.com", "guest@proton.me",
            "guest@euploading.com.example.org", "guest@notmail.tm.example.org",
        ):
            with self.subTest(email=email):
                self.assertFalse(is_disposable_email(email))

    def test_configured_additions_and_exact_domain_exceptions(self):
        with patch.dict(os.environ, {
            "SIGNUP_EMAIL_DOMAIN_BLOCKLIST_EXTRA": "test-disposable.example, second-disposable.example",
            "SIGNUP_EMAIL_DOMAIN_ALLOWLIST": "euploading.com, test-disposable.example",
        }):
            self.assertFalse(is_disposable_email("user@euploading.com"))
            self.assertFalse(is_disposable_email("user@test-disposable.example"))
            self.assertTrue(is_disposable_email("user@sub.test-disposable.example"))
            self.assertTrue(is_disposable_email("user@second-disposable.example"))

    def test_missing_domain_data_fails_closed(self):
        from demo_disposable_email import LIST_PATH
        _bundled_domains.cache_clear()
        try:
            with patch.object(type(LIST_PATH), "open", side_effect=FileNotFoundError):
                with self.assertRaises(HTTPException) as error:
                    require_signup_email_allowed("anyone@example.com")
            self.assertEqual(error.exception.status_code, 503)
            self.assertEqual(error.exception.detail, "signup_email_filter_unavailable")
        finally:
            _bundled_domains.cache_clear()


if __name__ == "__main__":
    unittest.main()
