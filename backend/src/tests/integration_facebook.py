"""Real PostgreSQL email-confirmed Facebook login; external Meta/email calls mocked."""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.parse import parse_qs,urlsplit

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Unsafe test database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount
from demo_facebook import FacebookIdentity,FacebookPending
from demo_account_recovery import VerifiedEmail
from demo_quick_signup import QuickPrivacyConsent


class FacebookPostgresTests(unittest.TestCase):
    def test_atomic_callback_and_email_verified_signup(self):
        suffix=secrets.token_hex(12)
        profile={"id":"".join(str(int(c,16)) for c in suffix),
                 "email":suffix+"@example.test","first_name":"FB","last_name":"CI"}
        sent=[]
        with patch.dict(os.environ,{
                "FACEBOOK_APP_ID":"1234567890123456",
                "FACEBOOK_APP_SECRET":"ci-facebook-secret-at-least-sixteen-characters",
                "FACEBOOK_REDIRECT_URI":"https://example.test/api/auth/facebook/callback",
                "AUTH_CODE_SECRET":"ci-test-key-at-least-thirty-two-characters-long",
                "TICKETTREAT_IDENTITY_REGISTRY_MODE":"off"}),\
             patch("demo_facebook.exchange_code",return_value=profile),\
             patch("demo_email.configured",return_value=True),\
             patch("demo_account_recovery.send_code",side_effect=lambda email,purpose,code:sent.append(code)),\
             TestClient(main.app) as client:
            started=client.post("/demo/auth/facebook/start",json={})
            self.assertEqual(started.status_code,200,started.text)
            params=parse_qs(urlsplit(started.json()["url"]).query)
            payload={"state":params["state"][0],"browser_token":started.json()["browser_token"],"code":"fake"}
            with ThreadPoolExecutor(max_workers=2) as pool:
                callbacks=list(pool.map(lambda _:client.post("/demo/auth/facebook/finish",json=payload),range(2)))
            self.assertEqual(sorted(r.status_code for r in callbacks),[202,400])
            pending=next(r.json()["pending_token"] for r in callbacks if r.status_code==202)
            with SessionLocal() as db:
                self.assertEqual(db.query(WebAccount).filter(WebAccount.email==profile["email"]).count(),0)
                self.assertEqual(db.query(FacebookPending).filter(FacebookPending.subject==profile["id"]).count(),1)
            confirmed=client.post("/demo/auth/facebook/confirm",json={
                "code":sent[0],"privacy_accepted":True,"privacy_version":"2026-10"},
                headers={"X-Facebook-Pending-Proof":pending})
            self.assertEqual(confirmed.status_code,200,confirmed.text)
            token=confirmed.json()["token"]
            me=client.get("/demo/auth/me",headers={"Authorization":"Bearer "+token})
            self.assertEqual(me.status_code,200,me.text)
            self.assertTrue(me.json()["email_verified"])
            account_id=me.json()["account"]["id"]
            with SessionLocal() as db:
                self.assertEqual(db.get(FacebookIdentity,profile["id"]).account_id,account_id)
                self.assertIsNotNone(db.get(VerifiedEmail,account_id))
                self.assertIsNotNone(db.get(QuickPrivacyConsent,account_id))
                self.assertEqual(db.query(FacebookPending).filter(FacebookPending.subject==profile["id"]).count(),0)


if __name__=="__main__":unittest.main()
