"""Offline cryptographic and configuration checks for Telegram's official OIDC."""
import base64
import json
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import HTTPException

from demo_telegram_oidc import verify_id_token, credentials


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


class TelegramOidcVerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537,key_size=2048)
        public = cls.key.public_key().public_numbers()
        cls.keys = {"keys":[{
            "kid":"ci-rsa-key","kty":"RSA","use":"sig","alg":"RS256",
            "n":b64(public.n.to_bytes((public.n.bit_length()+7)//8,"big")),
            "e":b64(public.e.to_bytes((public.e.bit_length()+7)//8,"big")),
        }]}

    def signed(self, **overrides):
        now=int(time.time())
        claims = {"iss":"https://oauth.telegram.org","aud":"555222111",
                  "sub":"123456781234","id":123456781234,
                  "nonce":"ci-nonce","iat":now,"exp":now+120}
        claims.update(overrides)
        header=b64(json.dumps({"alg":"RS256","kid":"ci-rsa-key"}).encode())
        body=b64(json.dumps(claims).encode())
        raw=(header+"."+body).encode()
        signature=self.key.sign(raw,padding.PKCS1v15(),hashes.SHA256())
        return header+"."+body+"."+b64(signature)

    def verified(self, token, nonce="ci-nonce", client="555222111"):
        data=json.dumps(self.keys).encode()
        with patch("demo_telegram_oidc.requests.get",return_value=SimpleNamespace(
                status_code=200,content=data,json=lambda:self.keys)):
            return verify_id_token(token,client,nonce)

    def test_correct_signature_and_identity(self):
        result=self.verified(self.signed())
        self.assertEqual(result["sub"],"123456781234")

    def test_rejects_wrong_audience_nonce_expiry_and_invalid_id(self):
        now=int(time.time())
        for overrides in (
            {"aud":"someone-else"},{"nonce":"replayed"},
            {"exp":now-1},{"iat":now+300},
            {"id":None},{"id":"123456781234"},{"id":-42},
        ):
            with self.subTest(overrides=overrides):
                with self.assertRaises(HTTPException):
                    self.verified(self.signed(**overrides))

    def test_telegram_oidc_subject_can_differ_from_bot_user_id(self):
        # Telegram OIDC lists distinct sub and id. The signed profile id
        # is the canonical Bot API/Mini App identity.
        claims = self.verified(self.signed(
            sub="1234123412341234123", id=987654321))
        self.assertEqual(claims["sub"], "1234123412341234123")
        self.assertEqual(claims["id"], 987654321)

    def test_rejects_tampered_signature_and_unsigned_algorithm(self):
        token=self.signed()
        signed_payload=token.split(".")
        bad=signed_payload[0]+"."+b64(json.dumps({"sub":"55"}).encode())+"."+signed_payload[2]
        with self.assertRaises(HTTPException):
            self.verified(bad)
        unsigned=b64(json.dumps({"alg":"none","kid":"ci-rsa-key"}).encode())+"."+signed_payload[1]+"."
        with self.assertRaises(HTTPException):
            self.verified(unsigned)

    def test_missing_botfather_secrets_fail_closed(self):
        with patch.dict("os.environ",{"TELEGRAM_LOGIN_CLIENT_ID":"",
                                   "TELEGRAM_LOGIN_CLIENT_SECRET":"",
                                   "TELEGRAM_LOGIN_REDIRECT_URI":""}):
            with self.assertRaises(HTTPException) as exc:
                credentials()
            self.assertEqual(exc.exception.status_code,503)


if __name__=="__main__":
    unittest.main()
