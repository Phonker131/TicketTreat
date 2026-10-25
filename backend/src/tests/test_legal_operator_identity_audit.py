"""Public operator block is legible and does not invent a corporate identity."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[3]
FRONTEND=ROOT/"frontend"

class LegalOperatorIdentityAuditTests(unittest.TestCase):
    def test_complete_operator_requires_real_identity_and_valid_ico(self):
        src=(FRONTEND/"lib"/"legal-operator.ts").read_text(encoding="utf-8")
        for snippet in (
            'validCzechIco(rawIco)',
            'Boolean(name&&address&&email&&identificationNumber)',
            'status:complete?"complete":"incomplete"',
            '"LEGAL_OPERATOR_NAME"',
            '"LEGAL_OPERATOR_ADDRESS"',
            '"LEGAL_PRIVACY_EMAIL"',
            '"LEGAL_CONTACT_EMAIL"',
            '"LEGAL_OPERATOR_ICO"',
            'privacy@tickettreat.eu',
            'contact@tickettreat.eu',
        ):
            self.assertIn(snippet,src)

    def test_operator_identity_remains_env_driven_and_bilingual(self):
        src=(FRONTEND/"components"/"LegalOperatorIdentity.tsx").read_text(encoding="utf-8")
        self.assertIn('Who is responsible',src)
        self.assertIn('Kdo je odpovědný',src)
        self.assertIn('lang="cs"',src)
        for snippet in ('{op.name}','{op.address}','{op.identificationNumber}',
                        'op.identificationNumber&&','op.address&&','op.contactEmail','op.email',
                        'mailto:', 'href="/support"'):
            self.assertIn(snippet,src)
        self.assertNotIn('Vladislav Vereshchagin',src)
        self.assertNotIn('being finalized',src)
        self.assertNotIn('tt-legal-operator-pending',src)
        footer=(FRONTEND/"components"/"LegalFooter.tsx").read_text(encoding="utf-8")
        self.assertNotIn("LEGAL_OPERATOR_NAME",footer)
        self.assertNotIn("LEGAL_OPERATOR_ICO",footer)

    def test_operator_uses_responsive_contrast_and_accessible_links(self):
        css=(FRONTEND/"app"/"brand-refresh.css").read_text(encoding="utf-8")
        for snippet in ('.tt-legal-operator-lead','.tt-legal-operator-czech',
                        '@media(max-width:480px)', '.tt-legal-operator a:focus-visible',
                        'overflow-wrap:anywhere'):
            self.assertIn(snippet,css)

if __name__=="__main__":
    unittest.main()
