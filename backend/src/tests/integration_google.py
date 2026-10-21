"""Real PostgreSQL/session integration; only the external Google exchange is mocked."""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Unsafe test database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_google import GoogleIdentity
from demo_mfa import MFASession
from demo_roles import WebAccountRole


class GooglePostgresTests(unittest.TestCase):
    def test_atomic_callback_session_and_mfa(self):
        identifier=secrets.token_hex(12)
        claims={"sub":"ci-"+identifier,"email":identifier+"@gmail.com","email_verified":True,
                "given_name":"Google","family_name":"CI"}
        with patch.dict(os.environ,{"GOOGLE_CLIENT_ID":"ci","GOOGLE_CLIENT_SECRET":"ci",
                "GOOGLE_REDIRECT_URI":"https://example.test/api/auth/google/callback"}), \
                patch("demo_google.exchange_code",return_value=claims), TestClient(main.app) as client:
            def begin():
                response=client.post("/demo/auth/google/start",json={})
                self.assertEqual(response.status_code,200,response.text)
                data=response.json()
                return {"state":parse_qs(urlsplit(data["url"]).query)["state"][0],
                        "browser_token":data["browser_token"],"code":"ci-code"}
            flow=begin()
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses=list(pool.map(lambda _:client.post("/demo/auth/google/finish",json=flow),range(2)))
            self.assertEqual(sorted(r.status_code for r in responses),[200,400])
            auth=next(r.json() for r in responses if r.status_code==200)
            headers={"Authorization":"Bearer "+auth["token"]}
            me=client.get("/demo/auth/me",headers=headers)
            self.assertEqual(me.status_code,200,me.text)
            self.assertTrue(me.json()["email_verified"])
            aid=me.json()["account"]["id"]
            with SessionLocal() as db:
                self.assertEqual(db.get(GoogleIdentity,claims["sub"]).account_id,aid)
                db.query(WebAccountRole).filter(WebAccountRole.account_id==aid).update({"role":"organizer"})
                db.commit()
            second=client.post("/demo/auth/google/finish",json=begin())
            self.assertEqual(second.status_code,200,second.text)
            token=second.json()["token"]
            with SessionLocal() as db:
                self.assertIsNone(db.get(MFASession,token_hash(token)))
                self.assertEqual(db.query(WebAccount).filter(WebAccount.email==claims["email"]).count(),1)
            denied=client.get("/demo/manage/me",headers={"Authorization":"Bearer "+token})
            self.assertEqual(denied.status_code,403,denied.text)
