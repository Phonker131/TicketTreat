"""The platform brand must never be substituted for Czech statutory operator data."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[3]
FRONTEND=ROOT/"frontend"

class LegalOperatorIdentityAuditTests(unittest.TestCase):
    def test_complete_operator_requires_real_identity_and_valid_ico(self):
        src=(FRONTEND/"lib"/"legal-operator.ts").read_text(encoding="utf-8")
        self.assertIn('validCzechIco(rawIco)',src)
        self.assertIn('Boolean(name&&address&&email&&identificationNumber)',src)
        self.assertIn('status:complete?"complete":"incomplete"',src)
        self.assertIn('"LEGAL_OPERATOR_NAME"',src)
        self.assertIn('"LEGAL_OPERATOR_ADDRESS"',src)
        self.assertIn('"LEGAL_PRIVACY_EMAIL"',src)
        self.assertIn('"LEGAL_OPERATOR_ICO"',src)

    def test_public_brand_and_verified_operator_are_separate(self):
        src=(FRONTEND/"components"/"LegalOperatorIdentity.tsx").read_text(encoding="utf-8")
        self.assertIn('TicketTreat is the platform brand',src)
        self.assertIn('op.status==="complete"',src)
        self.assertIn('{op.name}',src)
        self.assertIn('{op.address}',src)
        self.assertIn('{op.identificationNumber}',src)
        self.assertIn('not yet verified',src)
        footer=(FRONTEND/"components"/"LegalFooter.tsx").read_text(encoding="utf-8")
        self.assertNotIn("LEGAL_OPERATOR_NAME",footer)
        self.assertNotIn("LEGAL_OPERATOR_ICO",footer)

if __name__=="__main__":
    unittest.main()
