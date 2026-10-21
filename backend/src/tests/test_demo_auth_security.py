"""Compatibility checks for new and legacy account password hashes."""
import hashlib
import secrets
import unittest
from fastapi import HTTPException
from demo_auth_security import hash_password, verify_password, needs_rehash, validate_new_password

class PasswordTests(unittest.TestCase):
    def test_argon2id(self):
        a = hash_password("correct horse battery staple")
        b = hash_password("correct horse battery staple")
        self.assertTrue(a.startswith("$argon2id$"))
        self.assertNotEqual(a,b)
        self.assertTrue(verify_password("correct horse battery staple",a))
        self.assertFalse(verify_password("bad",a))
        self.assertFalse(needs_rehash(a))

    def test_pbkdf2_legacy(self):
        password="existing-account-password"
        salt=secrets.token_bytes(16)
        digest=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,350000)
        legacy="$".join(["pbkdf2_sha256","350000",salt.hex(),digest.hex()])
        self.assertTrue(verify_password(password,legacy))
        self.assertFalse(verify_password("wrong",legacy))
        self.assertTrue(needs_rehash(legacy))

    def test_invalid_hash(self):
        for value in ("","raw-password","$argon2id$broken","pbkdf2_sha256$0$00$00"):
            self.assertFalse(verify_password("whatever",value))

    def test_new_password_length(self):
        validate_new_password("new-long-password")
        with self.assertRaises(HTTPException):
            validate_new_password("short")

if __name__=="__main__":
    unittest.main()
