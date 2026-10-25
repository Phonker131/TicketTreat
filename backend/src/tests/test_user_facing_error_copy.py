"""Regression checks for user-facing errors and cookie consent copy.

Static, credential-free checks; TypeScript compilation is covered by CI.
"""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"


class UserFacingCopyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        src = (FRONTEND / "lib/user-facing-errors.ts").read_text(encoding="utf-8")
        match = re.search(
            r"const MESSAGES: Record<string,Record<LanguageCode,string>> = (\{[\s\S]*?\});\nconst FALLBACK:",
            src,
        )
        assert match, "No centralized messages dictionary"
        cls.messages = json.loads(match.group(1))
        fallback = re.search(
            r"const FALLBACK: Record<string,Record<LanguageCode,string>> = (\{[\s\S]*?\});\n",
            src,
        )
        assert fallback, "No error fallback dictionary"
        cls.fallback = json.loads(fallback.group(1))
        cls.helper = src

    def test_every_error_has_four_nonempty_localizations(self):
        for category, dictionary in (("messages", self.messages), ("fallback", self.fallback)):
            for code, translations in dictionary.items():
                with self.subTest(category=category, code=code):
                    self.assertEqual(set(translations), {"en", "cs", "ru", "uk"})
                    self.assertTrue(all(isinstance(value, str) and len(value) > 25
                                        for value in translations.values()))
                    self.assertNotRegex(translations["en"] + translations["cs"], r"[\u0400-\u052f]")

    def test_auth_booking_ticket_and_mfa_codes_have_instructions(self):
        for code in (
            "login_required", "invalid_session", "invalid_credentials",
            "email_verification_required", "invalid_or_expired_code",
            "mfa_enrollment_required", "mfa_challenge_required", "invalid_mfa_code",
            "event_full", "event_not_found", "event_cancelled",
            "already_registered_via_bot", "payment_deadline_expired",
            "organizer_payment_instructions_missing", "support_ticket_closed",
            "organizer_role_required", "invalid_qr_token",
        ):
            with self.subTest(code=code):
                self.assertIn(code, self.messages)

    def test_server_outages_do_not_blame_user(self):
        for language in ("en", "cs", "ru", "uk"):
            with self.subTest(lang=language):
                self.assertNotEqual(self.fallback["outage"][language], self.fallback["validation"][language])
                self.assertNotEqual(self.fallback["outage"][language], self.fallback["forbidden"][language])
        self.assertIn("httpStatus>=500", self.helper)
        self.assertIn("FALLBACK.network[language]", self.helper)

    def test_cookie_labels_keep_privacy_choice_semantics(self):
        cookie = (FRONTEND / "components/CookieConsentBanner.tsx").read_text(encoding="utf-8")
        consent = (FRONTEND / "lib/cookie-consent.ts").read_text(encoding="utf-8")
        for text in ('Разрешить cookies', 'Allow cookies', 'Povolit cookies', 'Дозволити cookies'):
            self.assertIn(f'accept:"{text}"', cookie)
        self.assertIn('onClick={() => decide(true)}', cookie)
        self.assertIn('onClick={() => decide(false)}', cookie)
        self.assertIn('saveConsent(externalMedia)', cookie)
        self.assertIn('externalMedia: boolean', consent)
        self.assertIn('CONSENT_VERSION = "2026-10-23/maps-v1"', consent)
        self.assertNotIn('analytics: true', consent)
        self.assertNotIn('marketing: true', consent)

    def test_key_user_screens_use_shared_error_translator(self):
        for name in (
            "ProfileClient.tsx", "CheckoutClient.tsx", "TicketsClient.tsx",
            "SupportClient.tsx", "EventDetailClient.tsx", "PrivacyClient.tsx",
            "MFAClient.tsx", "AdminPrivacyClient.tsx", "AdminEventClient.tsx",
            "CheckInClient.tsx", "AdminClient.tsx", "BroadcastClient.tsx",
        ):
            with self.subTest(screen=name):
                source = (FRONTEND / "components" / name).read_text(encoding="utf-8")
                self.assertIn('from "@/lib/user-facing-errors"', source)
                self.assertIn("userFacingError(", source)


if __name__ == "__main__":
    unittest.main()
