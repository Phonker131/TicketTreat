"""End-to-end identity/session regressions on disposable CI PostgreSQL ONLY."""
import json
import os
import secrets
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit, parse_qs
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Telegram OIDC integration may run only against disposable CI PostgreSQL")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession
from demo_telegram import DemoTelegramIdentity
from integration_telegram_browser_link import BOT_TOKEN,signed_init_data,website_account


class UnifiedTelegramIdentityTests(unittest.TestCase):
    def setUp(self):
        self.keys = {
            "TELEGRAM_MINIAPP_BOT_TOKEN":BOT_TOKEN,
            "TELEGRAM_LOGIN_CLIENT_ID":"12345678",
            "TELEGRAM_LOGIN_CLIENT_SECRET":"ci-client-secret-not-real-1234567890",
            "TELEGRAM_LOGIN_REDIRECT_URI":"https://tickettreat.eu/api/auth/telegram/callback",
        }
        self.previous={name:os.environ.get(name) for name in self.keys}
        os.environ.update(self.keys)

    def tearDown(self):
        for key,old in self.previous.items():
            if old is None:os.environ.pop(key,None)
            else:os.environ[key]=old

    def oidc(self,client,tg_id,*,link=False,headers=None):
        start=client.post("/demo/auth/telegram/start",json={"link":link},headers=headers or {})
        self.assertEqual(start.status_code,200,start.text)
        data=start.json()
        state=parse_qs(urlsplit(data["url"]).query)["state"][0]
        response=client.post("/demo/auth/telegram/finish",json={
            "code":"telegram"+str(tg_id),"state":state,
            "browser_token":data["browser_token"]})
        self.assertEqual(response.status_code,200,response.text)
        replay=client.post("/demo/auth/telegram/finish",json={
            "code":"telegram"+str(tg_id),"state":state,
            "browser_token":data["browser_token"]})
        self.assertEqual(replay.status_code,400,replay.text)
        return response.json()

    @staticmethod
    def fake_exchange(code,verifier,redirect,client_id,secret,nonce):
        tg_id=int(code.removeprefix("telegram"))
        return {
            "iss":"https://oauth.telegram.org",
            "aud":client_id,"sub":str(tg_id+10000000000000000),"id":tg_id,
            "nonce":nonce,"given_name":"Verified Telegram",
            "family_name":"Tester",
        }

    def test_telegram_bot_first_desktop_login_reuses_exact_guest_and_tickets(self):
        tg_id=secrets.randbelow(10**12)+10**10
        other_id=secrets.randbelow(10**12)+10**10
        with patch("demo_telegram_oidc.exchange",side_effect=self.fake_exchange):
            with TestClient(main.app) as client:
                bot=client.post("/demo/telegram/auth",json={"init_data":signed_init_data(tg_id)})
                self.assertEqual(bot.status_code,200,bot.text)
                guest_id=bot.json()["guest"]["id"]
                account=self.oidc(client,tg_id)
                self.assertEqual(account["profile"]["guest"]["id"],guest_id)
                self.assertIsNone(account["profile"]["account"]["email"])
                self.assertFalse(account["profile"]["email_verified"])
                # A shadow WebAccount must not suppress the Mini App's option
                # to bind an existing independently verified email identity.
                telegram_again=client.post("/demo/telegram/auth",json={
                    "init_data":signed_init_data(tg_id)})
                self.assertEqual(telegram_again.status_code,200,telegram_again.text)
                self.assertFalse(telegram_again.json()["accounts_linked"])
                bearer={"Authorization":"Bearer "+account["token"]}
                self.assertEqual(client.get("/demo/auth/me",headers=bearer).status_code,200)
                self.assertEqual(client.get("/demo/me/tickets",headers=bearer).status_code,200)
                with SessionLocal() as db:
                    self.assertEqual(db.query(WebAccount).filter(WebAccount.guest_id==guest_id).count(),1)
                    self.assertEqual(db.get(DemoTelegramIdentity,tg_id).guest_id,guest_id)
                # Simultaneous logins / new devices cannot duplicate a principal.
                again=self.oidc(client,tg_id)
                self.assertEqual(again["profile"]["account"]["id"],account["profile"]["account"]["id"])
                other=self.oidc(client,other_id)
                self.assertNotEqual(other["profile"]["guest"]["id"],guest_id)
                with SessionLocal() as db:
                    self.assertEqual(db.query(WebAccount).filter(
                        WebAccount.guest_id==guest_id).count(),1)
                # Public role introspection is readable; Telegram-only users
                # must always remain participants and cannot manage events.
                identity=client.get("/demo/manage/me",headers=bearer)
                self.assertEqual(identity.status_code,200,identity.text)
                self.assertEqual(identity.json()["role"],"participant")
                blocked=client.get("/demo/manage/events/999999999/insights",
                                   headers=bearer)
                self.assertEqual(blocked.status_code,403,blocked.text)

    def test_web_first_account_link_revokes_telegram_shadow_sessions(self):
        tg_id=secrets.randbelow(10**12)+10**10
        website_id, website_guest, website_bearer=website_account()
        with patch("demo_telegram_oidc.exchange",side_effect=self.fake_exchange):
            with TestClient(main.app) as client:
                shadow=self.oidc(client,tg_id)
                shadow_headers={"Authorization":"Bearer "+shadow["token"]}
                self.assertIsNone(shadow["profile"]["account"]["email"])
                confirmed=client.post("/demo/telegram/link",json={"init_data":signed_init_data(tg_id)},
                    headers={"Authorization":"Bearer "+website_bearer})
                self.assertEqual(confirmed.status_code,200,confirmed.text)
                self.assertTrue(confirmed.json()["linked"])
                with SessionLocal() as db:
                    self.assertEqual(db.get(DemoTelegramIdentity,tg_id).guest_id,website_guest)
                    self.assertEqual(db.query(WebSession).filter(
                        WebSession.account_id==shadow["profile"]["account"]["id"]).count(),0)
                self.assertEqual(client.get("/demo/auth/me",headers=shadow_headers).status_code,401)
                self.assertEqual(client.get("/demo/auth/me",headers={
                    "Authorization":"Bearer "+website_bearer}).status_code,200)
                # Future Telegram login leads to the canonical website profile.
                future=self.oidc(client,tg_id)
                self.assertEqual(future["profile"]["account"]["id"],website_id)

    def test_browser_bot_login_needs_independent_http_only_proof_and_one_time_approval(self):
        tg_id=secrets.randbelow(10**12)+10**10
        with TestClient(main.app) as client:
            bot=client.post("/demo/telegram/auth",json={"init_data":signed_init_data(tg_id)})
            self.assertEqual(bot.status_code,200,bot.text)
            guest_id=bot.json()["guest"]["id"]
            init=client.post("/demo/auth/telegram/browser/start",json={})
            self.assertEqual(init.status_code,200,init.text)
            data=init.json()
            code=data["challenge"]
            verifier=data["browser_token"]
            pin=data["pin"]
            self.assertRegex(pin,r"^[0-9]{6}$")
            self.assertNotIn(pin,data["bot_link"])
            self.assertNotIn(verifier,data["bot_link"])
            self.assertIn("login_"+code,data["bot_link"])
            pending=client.post("/demo/auth/telegram/browser/complete",
                headers={"X-Telegram-Browser-Token":verifier},
                json={"challenge":code})
            self.assertEqual(pending.json()["status"],"pending")
            fake=client.post("/demo/auth/telegram/browser/claim",
                json={"challenge":code,"init_data":"unsigned-telegram-data"})
            self.assertEqual(fake.status_code,401,fake.text)
            bad_pin="000000" if pin!="000000" else "111111"
            wrong=client.post("/demo/auth/telegram/browser/claim",
                json={"challenge":code,"init_data":signed_init_data(tg_id),"pin":bad_pin})
            self.assertEqual(wrong.status_code,400,wrong.text)
            claimed=client.post("/demo/auth/telegram/browser/claim",
                json={"challenge":code,"init_data":signed_init_data(tg_id),"pin":pin})
            self.assertEqual(claimed.status_code,200,claimed.text)
            self.assertEqual(client.post("/demo/auth/telegram/browser/claim",
                json={"challenge":code,"init_data":signed_init_data(tg_id),"pin":pin}).status_code,409)
            denied=client.post("/demo/auth/telegram/browser/complete",
                headers={"X-Telegram-Browser-Token":"different-"+verifier},
                json={"challenge":code})
            self.assertEqual(denied.status_code,401,denied.text)
            no_cookie=client.post("/demo/auth/telegram/browser/complete",json={"challenge":code})
            self.assertEqual(no_cookie.status_code,401)
            finished=client.post("/demo/auth/telegram/browser/complete",
                headers={"X-Telegram-Browser-Token":verifier},
                json={"challenge":code})
            self.assertEqual(finished.status_code,200,finished.text)
            self.assertEqual(finished.json()["profile"]["guest"]["id"],guest_id)
            bearer={"Authorization":"Bearer "+finished.json()["token"]}
            self.assertEqual(client.get("/demo/auth/me",headers=bearer).status_code,200)
            replay=client.post("/demo/auth/telegram/browser/complete",
                headers={"X-Telegram-Browser-Token":verifier},
                json={"challenge":code})
            self.assertEqual(replay.status_code,409,replay.text)

    def test_old_bot_free_registration_appears_on_first_website_login(self):
        # A legacy /myevents user might never have opened the Mini App.
        # OIDC must reconcile eligible upcoming free registrations directly.
        tg_id=secrets.randbelow(10**12)+10**10
        with SessionLocal() as db:
            user=main.User(telegram_id=tg_id,first_name="Legacy user")
            event=main.Event(title="Telegram legacy CI ticket",price=Decimal("0"),
                starts_at=datetime.now(timezone.utc).replace(tzinfo=None)+timedelta(days=5),
                max_participants=20,currency="CZK")
            db.add_all([user,event]);db.flush()
            db.add(main.Registration(user_id=user.id,event_id=event.id))
            db.commit()
            event_id=event.id
        with patch("demo_telegram_oidc.exchange",side_effect=self.fake_exchange):
            with TestClient(main.app) as client:
                first=self.oidc(client,tg_id)
                headers={"Authorization":"Bearer "+first["token"]}
                tickets=client.get("/demo/me/tickets",headers=headers)
                self.assertEqual(tickets.status_code,200,tickets.text)
                matches=[ticket for ticket in tickets.json() if ticket["event_id"]==event_id]
                self.assertEqual(len(matches),1)
                self.assertEqual(matches[0]["payment_provider"],"legacy_free")
                second=self.oidc(client,tg_id)
                self.assertEqual(second["profile"]["guest"]["id"],
                                 first["profile"]["guest"]["id"])
                repeat=client.get("/demo/me/tickets",headers=headers).json()
                self.assertEqual(sum(t["event_id"]==event_id for t in repeat),1)

    def test_optional_email_requires_otp_and_does_not_merge_other_account(self):
        tg_id=secrets.randbelow(10**12)+10**10
        other_web,other_guest,other_bearer=website_account()
        with patch("demo_telegram_oidc.exchange",side_effect=self.fake_exchange):
            with TestClient(main.app) as client:
                user=self.oidc(client,tg_id)
                headers={"Authorization":"Bearer "+user["token"]}
                rejected=client.post("/demo/auth/email/attach/request",headers=headers,
                    json={"email":client.get("/demo/auth/me",headers={
                        "Authorization":"Bearer "+other_bearer}).json()["account"]["email"]})
                self.assertEqual(rejected.status_code,409,rejected.text)
                target=f"new-{secrets.token_hex(10)}@example.invalid"
                with patch("demo_account_recovery.send_code") as send:
                    requested=client.post("/demo/auth/email/attach/request",headers=headers,
                                          json={"email":target})
                    self.assertEqual(requested.status_code,200,requested.text)
                    otp=send.call_args.args[2]
                rejected=client.post("/demo/auth/email/attach/confirm",headers=headers,
                                     json={"email":target,"code":"00000000"})
                self.assertEqual(rejected.status_code,400,rejected.text)
                accepted=client.post("/demo/auth/email/attach/confirm",headers=headers,
                                     json={"email":target,"code":otp})
                self.assertEqual(accepted.status_code,200,accepted.text)
                profile=client.get("/demo/auth/me",headers=headers).json()
                self.assertEqual(profile["account"]["email"],target)
                self.assertTrue(profile["email_verified"])
                self.assertEqual(profile["guest"]["id"],user["profile"]["guest"]["id"])
                with SessionLocal() as db:
                    self.assertEqual(db.get(DemoTelegramIdentity,tg_id).guest_id,profile["guest"]["id"])
                    self.assertEqual(db.query(WebAccount).filter(WebAccount.email==target).count(),1)


if __name__=="__main__":
    unittest.main()
