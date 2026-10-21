"""Offsite backup encryption tests; no AWS or user data involved."""
import os
import secrets
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[3]/"scripts"))
from offsite_backup import MAGIC,encrypt_file,decrypt_file,backup_key


class EncryptedBackupTests(unittest.TestCase):
    def test_streaming_encrypted_archive_roundtrip(self):
        with tempfile.TemporaryDirectory() as root:
            directory=Path(root)
            plain=directory/"sample.dump"
            encrypted=directory/"sample.ttbk"
            restored=directory/"restored.dump"
            payload=secrets.token_bytes(2_250_000)
            plain.write_bytes(payload)
            key=secrets.token_bytes(32)
            checksum=encrypt_file(plain,encrypted,key)
            self.assertNotIn(payload[:50],encrypted.read_bytes())
            self.assertTrue(encrypted.read_bytes().startswith(MAGIC))
            self.assertEqual(len(checksum),64)
            decrypt_file(encrypted,restored,key)
            self.assertEqual(restored.read_bytes(),payload)

            tampered=bytearray(encrypted.read_bytes())
            tampered[250]^=1
            tampered_path=directory/"tampered.ttbk"
            tampered_path.write_bytes(tampered)
            with self.assertRaises(Exception):
                decrypt_file(tampered_path,directory/"tampered-output.dump",key)
            self.assertFalse((directory/"tampered-output.dump").exists())
            with self.assertRaises(Exception):
                decrypt_file(encrypted,directory/"wrong-key.dump",secrets.token_bytes(32))

    def test_backup_key_requires_real_nonzero_key(self):
        previous=os.environ.get("TT_BACKUP_KEY_HEX")
        try:
            os.environ["TT_BACKUP_KEY_HEX"]="0"*64
            with self.assertRaises(RuntimeError):
                backup_key()
            os.environ["TT_BACKUP_KEY_HEX"]=secrets.token_hex(32)
            self.assertEqual(len(backup_key()),32)
        finally:
            if previous is None:os.environ.pop("TT_BACKUP_KEY_HEX",None)
            else:os.environ["TT_BACKUP_KEY_HEX"]=previous


if __name__=="__main__":
    unittest.main()
