import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from db.base import Base
from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_recovery import VerifiedEmail
from demo_auth_security import hash_password
from demo_roles import WebAccountRole, GlobalAdminDelegation
from demo_google import GoogleIdentity, GoogleFlow, install_google_auth, validate_claims, exchange_code, probe_google_credentials_once


class OAuthTestGuest(Base):
    __tablename__ = "oauth_test_guests"
    id = Column(Integer, primary_key=True)
    access_token = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)


class GoogleAuthTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"GOOGLE_CLIENT_ID":"test-client", "GOOGLE_CLIENT_SECRET":"test-secret",
            "GOOGLE_REDIRECT_URI":"https://example.test/api/auth/google/callback", "APP_ENV":"production"})
        self.env.start(); self.addCleanup(self.env.stop)
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread":False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine, tables=[OAuthTestGuest.__table__, WebAccount.__table__,
            WebSession.__table__, VerifiedEmail.__table__, WebAccountRole.__table__, GlobalAdminDelegation.__table__, GoogleIdentity.__table__, GoogleFlow.__table__])
        self.sessions = sessionmaker(self.engine)
        def get_db():
            with self.sessions() as db: yield db
        def issue(db, account):
            raw = secrets.token_urlsafe(36)
            db.add(WebSession(account_id=account.id,token_hash=token_hash(raw),expires_at=datetime.now(timezone.utc)+timedelta(days=7)))
            db.commit(); return raw
        self.app = FastAPI()
        install_google_auth(self.app, get_db, OAuthTestGuest, issue, lambda a,db:{"id":a.id,"email":a.email})
        self.client = TestClient(self.app)
        self.addCleanup(self.client.close); self.addCleanup(self.engine.dispose)
        for name in ("guard_rate","record_rate"):
            p=patch("demo_google."+name);p.start();self.addCleanup(p.stop)
        self.claims={"sub":"google-subject", "email":"user@example.test", "email_verified":True,"hd":"example.test","given_name":"Test","family_name":"Person"}

    def start(self, **kwargs):
        response=self.client.post("/demo/auth/google/start",json=kwargs.pop("json",{}),**kwargs)
        self.assertEqual(response.status_code,200,response.text)
        data=response.json();params=parse_qs(urlsplit(data["url"]).query)
        self.assertEqual(params["code_challenge_method"],["S256"])
        self.assertEqual(params["scope"],["openid email profile"])
        return {"state":params["state"][0],"browser_token":data["browser_token"],"code":"one-time-code"}

    def finish(self, flow):
        with patch("demo_google.exchange_code",return_value=self.claims):
            return self.client.post("/demo/auth/google/finish",json=flow)

    def test_signup_repeat_login_and_replay(self):
        flow=self.start();first=self.finish(flow)
        self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(self.finish(flow).status_code,400)
        second=self.finish(self.start())
        self.assertEqual(first.json()["profile"],second.json()["profile"])
        self.assertNotEqual(first.json()["token"],second.json()["token"])
        with self.sessions() as db:
            self.assertEqual(db.query(WebAccount).count(),1)
            self.assertEqual(db.query(VerifiedEmail).count(),1)
            self.assertEqual(db.query(WebAccountRole).one().role,"participant")
            self.assertEqual(db.query(WebAccount).one().password_hash,"!google-only")

    def test_wrong_browser_state_and_expiry(self):
        flow=self.start()
        self.assertEqual(self.finish({**flow,"browser_token":"x"*43}).status_code,400)
        self.assertEqual(self.finish({**flow,"state":"x"*43}).status_code,400)
        with self.sessions() as db:
            db.query(GoogleFlow).update({"expires_at":datetime.now(timezone.utc)-timedelta(seconds=1)});db.commit()
        self.assertEqual(self.finish(flow).status_code,400)

    def existing(self):
        with self.sessions() as db:
            a=WebAccount(email=self.claims["email"],first_name="Existing",last_name="User",guest_id=42,
                         password_hash=hash_password("existing-password-123"))
            db.add(a);db.flush();aid=a.id
            raw=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=aid,token_hash=token_hash(raw),expires_at=datetime.now(timezone.utc)+timedelta(days=1)))
            db.add(WebAccountRole(account_id=aid,role="participant"));db.commit()
        return aid,{"Authorization":"Bearer "+raw}

    def test_email_collision_requires_authenticated_password_link(self):
        aid,headers=self.existing()
        response=self.finish(self.start())
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()["detail"],"google_link_required")
        bad=self.client.post("/demo/auth/google/start",headers=headers,json={"link":True,"current_password":"wrong"})
        self.assertEqual(bad.status_code,401)
        flow=self.start(headers=headers,json={"link":True,"current_password":"existing-password-123"})
        response=self.finish(flow)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()["profile"]["id"],aid)
        with self.sessions() as db:
            self.assertEqual(db.query(WebAccount).count(),1)
            self.assertEqual(db.query(WebAccount).one().guest_id,42)

    def test_revoked_session_cannot_finish_link(self):
        _,headers=self.existing()
        flow=self.start(headers=headers,json={"link":True,"current_password":"existing-password-123"})
        with self.sessions() as db: db.query(WebSession).delete();db.commit()
        self.assertEqual(self.finish(flow).status_code,401)

    def test_provider_error_consumes_flow(self):
        flow=self.start()
        with patch("demo_google.exchange_code",side_effect=HTTPException(401,"google_exchange_failed")):
            self.assertEqual(self.client.post("/demo/auth/google/finish",json=flow).status_code,401)
        self.assertEqual(self.finish(flow).status_code,400)

    def test_disabled_without_config(self):
        with patch.dict(os.environ,{"GOOGLE_CLIENT_SECRET":""}):
            self.assertEqual(self.client.get("/demo/auth/google/status").json(),{"enabled":False})
            self.assertEqual(self.client.post("/demo/auth/google/start",json={}).status_code,503)

    def test_claim_binding(self):
        valid={**self.claims,"aud":"client","iss":"https://accounts.google.com","nonce":"expected"}
        self.assertEqual(validate_claims(valid,"client","expected"),valid)
        for key,value in [("aud","attacker"),("azp","attacker"),("iss","evil"),("nonce","wrong"),("email_verified",False),("sub","")]:
            with self.subTest(key=key),self.assertRaises(HTTPException):
                validate_claims({**valid,key:value},"client","expected")

    def test_signature_and_expiry_validation_failure_rejected(self):
        with patch("demo_google.requests.post") as post, patch("demo_google.verify_oauth2_token",side_effect=ValueError("invalid signature or expiry")) as verify:
            post.return_value.status_code=200;post.return_value.json.return_value={"id_token":"signed-token"}
            with self.assertRaises(HTTPException): exchange_code("code","verifier","nonce")
            self.assertEqual(verify.call_args.kwargs["audience"],"test-client")
            self.assertEqual(post.call_args.kwargs["data"]["code_verifier"],"verifier")

    def test_provider_invalid_client_is_logged_without_secrets(self):
        with patch("demo_google.requests.post") as post, patch("demo_google.logger.warning") as warning:
            post.return_value.status_code = 401
            post.return_value.json.return_value = {"error": "invalid_client", "error_description": "Secret with sensitive details"}
            with self.assertRaises(HTTPException) as result:
                exchange_code("confidential-one-time-code", "confidential-verifier", "nonce")
            self.assertEqual(result.exception.status_code, 401)
            self.assertEqual(result.exception.detail, "google_exchange_failed")
            self.assertIn("invalid_client", str(warning.call_args))
            self.assertNotIn("confidential-one-time-code", str(warning.call_args))
            self.assertNotIn("confidential-verifier", str(warning.call_args))
            self.assertNotIn("Secret with sensitive details", str(warning.call_args))

    def test_google_verification_failure_logs_only_exception_type(self):
        with patch("demo_google.requests.post") as post, patch("demo_google.verify_oauth2_token", side_effect=ValueError("secret user details")), patch("demo_google.logger.warning") as warning:
            post.return_value.status_code = 200
            post.return_value.json.return_value = {"id_token": "opaque"}
            with self.assertRaises(HTTPException) as result:
                exchange_code("sensitive-code", "sensitive-verifier", "nonce")
            self.assertEqual(result.exception.detail, "google_verification_failed")
            self.assertIn("ValueError", str(warning.call_args))
            self.assertNotIn("secret user details", str(warning.call_args))


    def test_google_probe_never_logs_secrets(self):
        with patch("demo_google.requests.post") as post, patch("demo_google.logger.warning") as warning:
            post.return_value.status_code=400
            post.return_value.json.return_value={"error":"invalid_grant"}
            probe_google_credentials_once()
            self.assertIn("accepted_by_google",str(warning.call_args))
            self.assertNotIn("test-secret",str(warning.call_args))
            self.assertEqual(post.call_args.kwargs["data"]["client_id"],"test-client")
            self.assertEqual(post.call_args.kwargs["data"]["client_secret"],"test-secret")

    def test_google_probe_detects_rejected_client(self):
        with patch("demo_google.requests.post") as post, patch("demo_google.logger.warning") as warning:
            post.return_value.status_code=401
            post.return_value.json.return_value={"error":"invalid_client"}
            probe_google_credentials_once()
            self.assertIn("rejected_by_google_invalid_client",str(warning.call_args))
            self.assertNotIn("test-secret",str(warning.call_args))

if __name__ == "__main__": unittest.main()
