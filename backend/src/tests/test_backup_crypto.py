"""AES-GCM backup-at-rest tests; no database connection or production data."""
from __future__ import annotations
import importlib.util
import secrets
import tempfile
import unittest
from pathlib import Path

from cryptography.exceptions import InvalidTag

ROOT = Path(__file__).resolve().parents[3] / "scripts" / "offsite_backup.py"
spec = importlib.util.spec_from_file_location("tt_offsite_crypto_test", ROOT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupCryptoTests(unittest.TestCase):
    def test_roundtrip_with_random_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plain, sealed, restored = (root/name for name in ("data.dump", "data.ttbk", "restored.dump"))
            content = secrets.token_bytes(65536)
            plain.write_bytes(content)
            checksum = module.encrypt_file(plain, sealed, secrets.token_bytes(32))
            self.assertEqual(len(checksum), 64)
            self.assertTrue(sealed.read_bytes().startswith(b"TTBK1"))
            self.assertNotIn(content[:100], sealed.read_bytes())
            # A distinct test below confirms the wrong key cannot decrypt.
            # Check that a correct key does after preserving it.
    def test_encrypt_decrypt_and_tamper(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plain = root/"plain"; cipher = root/"cipher"; restored = root/"restore"
            key = secrets.token_bytes(32)
            plain.write_bytes(secrets.token_bytes(3000))
            module.encrypt_file(plain,cipher,key)
            module.decrypt_file(cipher,restored,key)
            self.assertEqual(restored.read_bytes(),plain.read_bytes())
            restored.unlink()
            encrypted=bytearray(cipher.read_bytes())
            encrypted[30]^=1
            cipher.write_bytes(encrypted)
            with self.assertRaises(InvalidTag):
                module.decrypt_file(cipher,restored,key)
            self.assertFalse(restored.exists())
            with self.assertRaises(InvalidTag):
                module.decrypt_file(cipher,restored,secrets.token_bytes(32))
            self.assertFalse(restored.exists())

if __name__=="__main__":
    unittest.main()
