"""Offline regression checks for TicketTreat privacy requests and MFA guidance."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"


class PrivacyUserExperienceTests(unittest.TestCase):
    def test_privacy_page_has_no_unrendered_english_placeholders(self):
        src = (FRONTEND / "components/PrivacyClient.tsx").read_text(encoding="utf-8")
        self.assertNotIn('"explain": "{tr.explain}"', src)
        self.assertNotIn('"final": "{tr.final}"', src)
        self.assertIn('tr.googleHint', src)
        self.assertIn('tr.mfaAction', src)
        self.assertIn('href="/security/mfa"', src)
        self.assertIn('href="/support"', src)
        for language in ('"en"', '"cs"', '"ru"', '"uk"'):
            self.assertIn(language + ": {", src)

    def test_erasure_api_preserves_manual_review_reason(self):
        src = (FRONTEND / "lib/api.ts").read_text(encoding="utf-8")
        self.assertIn('raw.blockers', src)
        self.assertIn('typeof raw === "object"', src)
        self.assertNotIn('detail = payload?.detail || payload?.error || detail;', src)

    def test_admin_privacy_page_explains_second_factor(self):
        src = (FRONTEND / "components/AdminPrivacyClient.tsx").read_text(encoding="utf-8")
        self.assertIn('mfa_challenge_required', src)
        self.assertIn('mfa_enrollment_required', src)
        self.assertIn('manual_review_required', src)
        self.assertIn('href="/security/mfa"', src)

    def test_privileged_mfa_guard_is_server_enforced(self):
        roles = (BACKEND / "src/demo_roles.py").read_text(encoding="utf-8")
        privacy = (BACKEND / "src/demo_privacy.py").read_text(encoding="utf-8")
        self.assertIn('require_privileged_mfa(db,account,row)', roles)
        self.assertIn('account_lookup(db, authorization)', privacy)
        self.assertIn('account_lookup(db,authorization)', privacy)
        self.assertIn('confirmation: str = Field(pattern="^ERASE$")', privacy)
        self.assertIn('verify_password(payload.current_password, account.password_hash)', privacy)


if __name__ == "__main__":
    unittest.main()
