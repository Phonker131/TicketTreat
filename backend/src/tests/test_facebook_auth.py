import os
import secrets
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.base import Base
from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_bans import AccountBanAction, PermanentAccountBan
from demo_account_recovery import VerifiedEmail
from demo_auth_security import hash_password
from demo_roles import WebAccountRole, GlobalAdminDelegation
from demo_facebook import FacebookIdentity, FacebookFlow, FacebookPending, exchange_code, install_facebook_auth
from demo_quick_signup import QuickPrivacyConsent


class FacebookOAuthTestGuest(Base):
    __tablename__ = "facebook_oauth_test_guests"
    id = Column(Integer, primary_key=True)
    access_token = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String)


def response(payload, status=200):
    mock = Mock()
    mock.status_code = status
    mock.json.return_value = payload
    return mock


class FacebookAuthTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "FACEBOOK_APP_ID":"1234567890123456",
            "FACEBOOK_APP_SECRET":"dummy-development-secret-123456",
            "FACEBOOK_REDIRECT_URI":"https://example.test/api/auth/facebook/callback",
            "AUTH_CODE_SECRET":"test-secret-should-be-at-least-thirty-two-characters-long",
            "TICKETTREAT_IDENTITY_REGISTRY_MODE":"off",
            "APP_ENV":"production",
        })
        self.env.start(); self.addCleanup(self.env.stop)
        self.engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
        Base.metadata.create_all(self.engine,tables=[
            FacebookOAuthTestGuest.__table__,WebAccount.__table__,WebSession.__table__,
            AccountBanAction.__table__,PermanentAccountBan.__table__,VerifiedEmail.__table__,
            WebAccountRole.__table__,GlobalAdminDelegation.__table__,
            FacebookIdentity.__table__,FacebookFlow.__table__,FacebookPending.__table__,QuickPrivacyConsent.__table__,
        ])
        self.sessions=sessionmaker(self.engine)
        def get_db():
            with self.sessions() as db:yield db
        def issue(db,account):
            raw=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=account.id,token_hash=token_hash(raw),
                expires_at=datetime.now(timezone.utc)+timedelta(days=7)))
            db.commit();return raw
        self.app=FastAPI()
        install_facebook_auth(self.app,get_db,FacebookOAuthTestGuest,issue,lambda a,db:{"id":a.id,"email":a.email})
        self.client=TestClient(self.app)
        self.addCleanup(self.client.close);self.addCleanup(self.engine.dispose)
        for name in ("guard_rate","record_rate"):
            p=patch("demo_facebook."+name);p.start();self.addCleanup(p.stop)
        p=patch("demo_email.configured",return_value=True)
        p.start();self.addCleanup(p.stop)
        self.sent_codes=[]
        p=patch("demo_account_recovery.send_code",side_effect=lambda email,purpose,code:self.sent_codes.append((email,purpose,code)))
        p.start();self.addCleanup(p.stop)
        self.profile={"id":"1234567890","first_name":"Test","last_name":"Person","email":"user@example.test"}

    def start(self,**kwargs):
        result=self.client.post("/demo/auth/facebook/start",json=kwargs.pop("json",{}),**kwargs)
        self.assertEqual(result.status_code,200,result.text)
        data=result.json();params=parse_qs(urlsplit(data["url"]).query)
        self.assertEqual(params["scope"],["public_profile,email"])
        self.assertEqual(params["client_id"],["1234567890123456"])
        self.assertEqual(urlsplit(data["url"]).hostname,"www.facebook.com")
        return {"state":params["state"][0],"browser_token":data["browser_token"],"code":"one-time-code"}

    def finish(self,flow,profile=None):
        with patch("demo_facebook.exchange_code",return_value=self.profile if profile is None else profile):
            return self.client.post("/demo/auth/facebook/finish",json=flow)

    def confirm(self,result,code=None,consent=True):
        token=result.json()["pending_token"]
        code=self.sent_codes[-1][2] if code is None else code
        return self.client.post("/demo/auth/facebook/confirm",headers={"X-Facebook-Pending-Proof":token},
                                json={"code":code,"privacy_accepted":consent})

    def existing(self):
        with self.sessions() as db:
            a=WebAccount(email=self.profile["email"],first_name="Existing",last_name="User",guest_id=42,
                         password_hash=hash_password("secure-existing-password"))
            db.add(a);db.flush();id_=a.id
            raw=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=id_,token_hash=token_hash(raw),
                              expires_at=datetime.now(timezone.utc)+timedelta(days=1)))
            db.add(WebAccountRole(account_id=id_,role="participant"));db.commit()
        return id_,{"Authorization":"Bearer "+raw}

    def test_signup_requires_own_email_otp_and_privacy_acceptance(self):
        flow=self.start();first=self.finish(flow)
        self.assertEqual(first.status_code,202,first.text)
        self.assertEqual(self.finish(flow).status_code,400)
        with self.sessions() as db:self.assertEqual(db.query(WebAccount).count(),0)
        self.assertEqual(self.confirm(first,code="00000000").status_code,400)
        self.assertEqual(self.confirm(first,consent=False).status_code,422)
        registered=self.confirm(first)
        self.assertEqual(registered.status_code,200,registered.text)
        second=self.finish(self.start())
        self.assertEqual(registered.json()["profile"],second.json()["profile"])
        self.assertNotEqual(registered.json()["token"],second.json()["token"])
        self.assertEqual(self.confirm(first).status_code,400)
        with self.sessions() as db:
            self.assertEqual(db.query(WebAccount).count(),1)
            self.assertEqual(db.query(VerifiedEmail).count(),1)
            self.assertEqual(db.query(QuickPrivacyConsent).one().version,"2026-10")
            self.assertEqual(db.query(WebAccountRole).one().role,"participant")
            self.assertEqual(db.query(WebAccount).one().password_hash,"!facebook-only")

    def test_email_collision_requires_authenticated_link(self):
        aid,headers=self.existing()
        unauthorized=self.finish(self.start())
        self.assertEqual(unauthorized.status_code,409)
        self.assertEqual(unauthorized.json()["detail"],"facebook_link_required")
        self.assertEqual(self.client.post("/demo/auth/facebook/start",headers=headers,
            json={"link":True,"current_password":"wrong"}).status_code,401)
        flow=self.start(headers=headers,json={"link":True,"current_password":"secure-existing-password"})
        linked=self.finish(flow)
        self.assertEqual(linked.status_code,200,linked.text)
        self.assertEqual(linked.json()["profile"]["id"],aid)
        with self.sessions() as db:
            self.assertEqual(db.query(WebAccount).count(),1)
            self.assertEqual(db.query(FacebookIdentity).one().account_id,aid)

    def test_revoked_session_cannot_complete_link(self):
        _,headers=self.existing()
        flow=self.start(headers=headers,json={"link":True,"current_password":"secure-existing-password"})
        with self.sessions() as db:db.query(WebSession).delete();db.commit()
        self.assertEqual(self.finish(flow).status_code,401)

    def test_provider_failure_consumes_flow(self):
        flow=self.start()
        with patch("demo_facebook.exchange_code",side_effect=HTTPException(401,"facebook_exchange_failed")):
            self.assertEqual(self.client.post("/demo/auth/facebook/finish",json=flow).status_code,401)
        self.assertEqual(self.finish(flow).status_code,400)

    def test_wrong_browser_and_expiry(self):
        flow=self.start()
        self.assertEqual(self.finish({**flow,"browser_token":"x"*43}).status_code,400)
        self.assertEqual(self.finish({**flow,"state":"y"*43}).status_code,400)
        with self.sessions() as db:
            db.query(FacebookFlow).update({"expires_at":datetime.now(timezone.utc)-timedelta(seconds=1)})
            db.commit()
        self.assertEqual(self.finish(flow).status_code,400)

    def test_missing_email_blocks_new_signup_but_not_linked_login(self):
        no_email={"id":self.profile["id"],"first_name":"Test"}
        fresh=self.finish(self.start(),no_email)
        self.assertEqual(fresh.status_code,422)
        self.assertEqual(fresh.json()["detail"],"facebook_email_required")
        self.assertEqual(self.confirm(self.finish(self.start())).status_code,200)
        self.assertEqual(self.finish(self.start(),no_email).status_code,200)

    def test_different_subject_does_not_merge_on_email(self):
        self.assertEqual(self.confirm(self.finish(self.start())).status_code,200)
        another={**self.profile,"id":"5555555555"}
        other=self.finish(self.start(),another)
        self.assertEqual(other.status_code,409)
        self.assertEqual(other.json()["detail"],"facebook_link_required")

    def test_disabled_without_secret(self):
        with patch.dict(os.environ,{"FACEBOOK_APP_SECRET":""}):
            self.assertEqual(self.client.get("/demo/auth/facebook/status").json(),{"enabled":False})
            self.assertEqual(self.client.post("/demo/auth/facebook/start",json={}).status_code,503)

    def test_pending_requires_browser_proof_and_is_one_use(self):
        pending=self.finish(self.start())
        code=self.sent_codes[-1][2]
        self.assertEqual(self.client.post("/demo/auth/facebook/confirm",json={"code":code,"privacy_accepted":True}).status_code,401)
        self.assertEqual(self.client.post("/demo/auth/facebook/confirm",headers={"X-Facebook-Pending-Proof":"bad"*16},
                                         json={"code":code,"privacy_accepted":True}).status_code,400)
        with self.sessions() as db:
            db.query(FacebookPending).update({"expires_at":datetime.now(timezone.utc)-timedelta(seconds=1)})
            db.commit()
        self.assertEqual(self.confirm(pending).status_code,400)

    def test_five_bad_email_codes_block_confirmation(self):
        pending=self.finish(self.start())
        for _ in range(5):self.assertEqual(self.confirm(pending,code="00000000").status_code,400)
        self.assertEqual(self.confirm(pending).status_code,400)
        with self.sessions() as db:self.assertEqual(db.query(WebAccount).count(),0)

    def test_graph_debug_audience_expiry_subject_and_proof(self):
        now=int(datetime.now(timezone.utc).timestamp())
        result_token="X"*64
        debug={"data":{"app_id":"1234567890123456","is_valid":True,
                       "type":"USER","user_id":self.profile["id"],"expires_at":now+1800}}
        with patch("demo_facebook.requests.get",side_effect=[
            response({"access_token":result_token}),response(debug),response(self.profile),
        ]) as get:
            self.assertEqual(exchange_code("opaque-code"),self.profile)
            self.assertEqual(get.call_count,3)
            self.assertEqual(get.call_args_list[1].kwargs["params"]["input_token"],result_token)
            self.assertEqual(get.call_args_list[2].kwargs["params"]["fields"],"id,first_name,last_name,name,email")
            self.assertEqual(len(get.call_args_list[2].kwargs["params"]["appsecret_proof"]),64)
            self.assertTrue(all(c.kwargs["allow_redirects"] is False for c in get.call_args_list))
        for change in ({"app_id":"wrong"},{"is_valid":False},{"type":"PAGE"},
                       {"expires_at":now-1},{"user_id":"other"}):
            with self.subTest(change=change),patch("demo_facebook.requests.get",side_effect=[
                response({"access_token":result_token}),response({"data":{**debug["data"],**change}}),
            ]) as get:
                with self.assertRaises(HTTPException):exchange_code("opaque-code")
                self.assertEqual(get.call_count,2)
        with patch("demo_facebook.requests.get",side_effect=[
            response({"access_token":result_token}),response(debug),response({**self.profile,"id":"different"}),
        ]):
            with self.assertRaises(HTTPException):exchange_code("opaque-code")

    def test_graph_provider_errors_never_log_tokens_or_secrets(self):
        with patch("demo_facebook.requests.get",return_value=response({"error":"sensitive token"},status=400)), \
             patch("demo_facebook.logger.warning") as warning:
            with self.assertRaises(HTTPException):exchange_code("SECRET-CODE")
            log=str(warning.call_args)
            self.assertNotIn("SECRET-CODE",log)
            self.assertNotIn("dummy-development-secret",log)
            self.assertNotIn("sensitive token",log)


if __name__=="__main__":unittest.main()
