"""Regression tests for Apple Wallet pass signing, content and ownership-dependent input."""
import hashlib
import io
import json
import os
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from fastapi import HTTPException

from demo_wallet import build_pass, configured


def cert_and_key(name):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now = datetime.now(timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - timedelta(days=1))
            .not_valid_after(now + timedelta(days=30))
            .sign(key, hashes.SHA256()))
    return (cert.public_bytes(serialization.Encoding.PEM).decode(),
            key.private_bytes(serialization.Encoding.PEM,
                              serialization.PrivateFormat.PKCS8,
                              serialization.NoEncryption()).decode())


class WalletPassTests(unittest.TestCase):
    def setUp(self):
        cert, key = cert_and_key("Test TicketTreat Pass")
        wwdr, _ = cert_and_key("Test Apple WWDR")
        self.env = patch.dict(os.environ, {
            "APPLE_WALLET_PASS_TYPE_ID": "pass.eu.tickettreat.test",
            "APPLE_WALLET_TEAM_ID": "TEAMTEST12",
            "APPLE_WALLET_CERT_PEM": cert,
            "APPLE_WALLET_KEY_PEM": key,
            "APPLE_WALLET_WWDR_PEM": wwdr,
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.event = SimpleNamespace(title="Demo Concert", location="Prague venue",
            starts_at=datetime(2026,11,10,19,0,tzinfo=timezone.utc),is_cancelled=False)
        self.ticket = SimpleNamespace(id=42, code="TT-2026-0042",
            qr_token="opaque-qr-token",ticket_status="active")

    def test_signed_zip_has_manifest_signature_and_scanner_qr(self):
        self.assertTrue(configured())
        payload = build_pass(self.ticket, self.event)
        with zipfile.ZipFile(io.BytesIO(payload)) as z:
            data = json.loads(z.read("pass.json"))
            manifest = json.loads(z.read("manifest.json"))
            self.assertEqual(data["passTypeIdentifier"],"pass.eu.tickettreat.test")
            self.assertEqual(data["serialNumber"],"tickettreat-42")
            self.assertEqual(data["barcodes"][0]["message"],
                             "TICKETTREAT:TICKET:opaque-qr-token")
            self.assertTrue(len(z.read("signature"))>50)
            for name,sha in manifest.items():
                self.assertEqual(hashlib.sha1(z.read(name)).hexdigest(),sha)
            self.assertIn("icon.png",manifest)
            self.assertIn("logo.png",manifest)

    def test_cancelled_pass_is_rejected(self):
        self.ticket.ticket_status="cancelled"
        with self.assertRaises(HTTPException) as ctx:
            build_pass(self.ticket,self.event)
        self.assertEqual(ctx.exception.status_code,409)

    def test_disabled_provider_never_builds_unsigned_pass(self):
        with patch.dict(os.environ,{"APPLE_WALLET_CERT_PEM":""}):
            self.assertFalse(configured())
            with self.assertRaises(HTTPException) as ctx:
                build_pass(self.ticket,self.event)
            self.assertEqual(ctx.exception.status_code,503)


if __name__ == "__main__":
    unittest.main()
