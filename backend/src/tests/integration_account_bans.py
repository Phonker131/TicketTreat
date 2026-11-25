"""Global-admin account bans against a disposable PostgreSQL CI database."""
import hashlib
import hmac
import json
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from urllib.parse import urlencode

from fastapi import HTTPException
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Requires disposable tickettreat_ci database")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount, WebSession, token_hash
from demo_account_bans import AccountBanAction, PermanentAccountBan
from demo_auth_security import hash_password
from demo_mfa import MFAFactor, MFASession
from demo_account_recovery import EmailChallenge, TelegramEmailClaim, VerifiedEmail, create_challenge
from demo_telegram import DemoTelegramIdentity


def telegram_initdata(telegram_id, bot_token):
    payload = {
        "auth_date": str(int(time.time())),
        "user": json.dumps({"id": telegram_id, "first_name": "Banned user"}, separators=(",", ":")),
    }
    check = "\n".join(f"{key}={value}" for key, value in sorted(payload.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    payload["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(payload)


class AccountBanTests(unittest.TestCase):
    def test_ban_revokes_sessions_blocks_telegram_and_can_be_reversed(self):
        previous = {key: os.getenv(key) for key in
                    ("GLOBAL_ADMIN_ACCOUNT_IDS", "APP_ENV", "TELEGRAM_MINIAPP_BOT_TOKEN")}
        admin_token = secrets.token_urlsafe(36)
        target_token = secrets.token_urlsafe(36)
        password = "ci-ban-password-strong-123"
        telegram_id = secrets.randbelow(10**12) + 10**10
        bot_token = "ci-test-only-telegram-bot-token"
        now = datetime.now(timezone.utc)
        with SessionLocal() as db:
            admin_guest = main.DemoGuest(access_token=secrets.token_urlsafe(32), first_name="CI Admin")
            target_guest = main.DemoGuest(access_token=secrets.token_urlsafe(32), first_name="CI Target")
            protected_guest = main.DemoGuest(access_token=secrets.token_urlsafe(32), first_name="CI Protected")
            db.add_all([admin_guest, target_guest, protected_guest]);db.flush()
            accounts = []
            for role, guest in (("admin", admin_guest), ("target", target_guest), ("protected", protected_guest)):
                account = WebAccount(email=f"ban-{role}-{secrets.token_hex(9)}@example.invalid",
                    password_hash=hash_password(password), first_name=role.title(), last_name="CI",
                    guest_id=guest.id, contact_preference="email")
                db.add(account);db.flush();accounts.append(account)
            admin, target, protected = accounts
            db.add_all([
                WebSession(account_id=admin.id, token_hash=token_hash(admin_token), expires_at=now+timedelta(days=1)),
                WebSession(account_id=target.id, token_hash=token_hash(target_token), expires_at=now+timedelta(days=1)),
                MFAFactor(account_id=admin.id, encrypted_secret=b"ci-unused-factor", enabled_at=now, created_at=now),
                MFASession(session_hash=token_hash(admin_token), account_id=admin.id,
                           verified_until=now+timedelta(hours=1)),
                MFASession(session_hash=token_hash(target_token), account_id=target.id,
                           verified_until=now+timedelta(hours=1)),
                EmailChallenge(account_id=target.id,purpose="reset",code_hash="0"*64,
                               expires_at=now+timedelta(minutes=10),attempts=0),
                TelegramEmailClaim(account_id=target.id,email="fixture@example.invalid",
                                   code_hash="1"*64,expires_at=now+timedelta(minutes=10),attempts=0),
                DemoTelegramIdentity(telegram_id=telegram_id, guest_id=target_guest.id),
            ])
            db.commit()
            admin_id, target_id, protected_id = admin.id, target.id, protected.id
            target_email, guest_token = target.email, target_guest.access_token
        os.environ.update({
            "GLOBAL_ADMIN_ACCOUNT_IDS": f"{admin_id},{protected_id}",
            "APP_ENV": "production", "TELEGRAM_MINIAPP_BOT_TOKEN": bot_token,
        })
        try:
            with TestClient(main.app) as client:
                headers = {"Authorization": f"Bearer {admin_token}"}
                target_headers = {"Authorization": f"Bearer {target_token}"}
                url = f"/demo/manage/accounts/{target_id}/ban"
                self.assertEqual(client.post(url, headers=target_headers,
                    json={"reason":"dangerous scripted activity"}).status_code, 403)
                # A global-admin cookie alone must not be able to ban users.
                with SessionLocal() as db:
                    db.query(MFASession).filter(
                        MFASession.session_hash == token_hash(admin_token)).delete()
                    db.commit()
                self.assertEqual(client.post(url, headers=headers,
                    json={"reason":"dangerous scripted activity"}).status_code, 403)
                with SessionLocal() as db:
                    db.add(MFASession(session_hash=token_hash(admin_token),
                        account_id=admin_id, verified_until=now+timedelta(hours=1)))
                    db.commit()
                self.assertEqual(client.post(f"/demo/manage/accounts/{admin_id}/ban",
                    headers=headers, json={"reason":"self-ban attempt"}).status_code, 403)
                self.assertEqual(client.post(f"/demo/manage/accounts/{protected_id}/ban",
                    headers=headers, json={"reason":"protected admin"}).status_code, 403)
                bad = client.post(url, headers=headers, json={"reason":"   "})
                self.assertEqual(bad.status_code, 422, bad.text)
                banned = client.post(url, headers=headers,
                    json={"reason":"dangerous scripted activity"})
                self.assertEqual(banned.status_code, 200, banned.text)
                self.assertTrue(banned.json()["banned"])
                with SessionLocal() as db:
                    self.assertEqual(db.query(WebSession).filter_by(account_id=target_id).count(),0)
                    self.assertEqual(db.query(MFASession).filter_by(account_id=target_id).count(),0)
                    self.assertEqual(db.query(EmailChallenge).filter_by(account_id=target_id).count(),0)
                    self.assertEqual(db.query(TelegramEmailClaim).filter_by(account_id=target_id).count(),0)
                self.assertEqual(client.post(url, headers=headers,
                    json={"reason":"again"}).status_code, 422)
                self.assertEqual(client.get("/demo/auth/me", headers=target_headers).status_code, 401)
                # Model a stale session row left behind by a failed revocation:
                # every independent authentication resolver must still refuse it.
                with SessionLocal() as db:
                    db.add(WebSession(account_id=target_id,token_hash=token_hash(target_token),
                                      expires_at=now+timedelta(hours=1)))
                    db.commit()
                try:
                    stale=client.post("/demo/auth/email/request-verification",headers=target_headers)
                    self.assertEqual(stale.status_code,403,stale.text)
                    self.assertEqual(stale.json()["detail"],"account_banned")
                    self.assertEqual(client.get("/demo/auth/me",headers=target_headers).status_code,403)
                finally:
                    with SessionLocal() as db:
                        db.query(WebSession).filter_by(account_id=target_id).delete()
                        db.commit()
                refused = client.post("/demo/auth/login", json={"email":target_email,"password":password})
                self.assertEqual(refused.status_code, 403, refused.text)
                self.assertEqual(refused.json()["detail"], "account_banned")
                signed = telegram_initdata(telegram_id, bot_token)
                self.assertEqual(client.post("/demo/telegram/auth", json={"init_data":signed}).status_code,403)
                self.assertEqual(client.get("/demo/me/tickets",
                    headers={"X-Telegram-Init-Data":signed}).status_code,403)
                self.assertEqual(client.get(f"/profile/{telegram_id}").status_code,403)
                self.assertEqual(client.get(f"/users/{telegram_id}/events").status_code,403)
                self.assertEqual(client.post("/events/987654321/register",
                    json={"telegram_id":telegram_id}).status_code,403)
                self.assertEqual(client.get(f"/demo/guests/{guest_token}/tickets",
                    headers={"X-Telegram-Init-Data":signed}).status_code,403)
                listed = client.get("/demo/manage/accounts",headers=headers)
                entry = next(a for a in listed.json() if a["account_id"] == target_id)
                self.assertTrue(entry["banned"])
                self.assertEqual(entry["ban_reason"],"dangerous scripted activity")
                self.assertEqual(client.put(f"/demo/manage/accounts/{target_id}/role",
                    headers=headers,json={"role":"organizer"}).status_code,409)
                unbanned = client.delete(url,headers=headers)
                self.assertEqual(unbanned.status_code,200,unbanned.text)
                self.assertFalse(unbanned.json()["banned"])
                history=client.get(f"/demo/manage/accounts/{target_id}/ban-history",headers=headers)
                self.assertEqual([x["action"] for x in history.json()[:2]],["unban","ban"])
                self.assertEqual(client.get("/demo/auth/me",headers=target_headers).status_code,401)
                login=client.post("/demo/auth/login",json={"email":target_email,"password":password})
                self.assertEqual(login.status_code,200,login.text)
                with SessionLocal() as db:
                    audit=db.query(AccountBanAction).filter(AccountBanAction.account_id==target_id).all()
                    self.assertEqual(len(audit),2)
                    self.assertTrue(all(a.actor_account_id==admin_id for a in audit))
                    # Permanent denial overrides even a prior administrative unban.
                    db.add(PermanentAccountBan(account_id=target_id,
                        reason="Owner-approved permanent security ban"))
                    db.commit()
                self.assertEqual(client.delete(url,headers=headers).status_code,403)
                refused=client.post("/demo/auth/login",json={"email":target_email,"password":password})
                self.assertEqual(refused.status_code,403,refused.text)
                self.assertEqual(refused.json()["detail"],"account_banned")
                self.assertEqual(client.get("/demo/auth/me",
                    headers={"Authorization":f"Bearer {login.json()['token']}"}).status_code,403)
                self.assertEqual(client.post("/demo/telegram/auth",json={"init_data":signed}).status_code,403)
                listed=client.get("/demo/manage/accounts",headers=headers)
                entry=next(a for a in listed.json() if a["account_id"]==target_id)
                self.assertTrue(entry["banned"])
                self.assertTrue(entry["permanent_ban"])
                self.assertEqual(client.get(f"/demo/manage/accounts/{target_id}/ban-history",
                    headers=headers).json()[0]["action"],"permanent_ban")
                # A banned, previously verified mailbox cannot request fresh
                # login/reset codes or redeem old ones to change credentials.
                with SessionLocal() as db:
                    db.add(VerifiedEmail(account_id=target_id,verified_at=now))
                    db.add(EmailChallenge(account_id=target_id,purpose="reset",
                        code_hash="0"*64,expires_at=now+timedelta(minutes=10),attempts=0))
                    db.commit()
                    before=db.get(WebAccount,target_id).password_hash
                with patch("demo_account_recovery.configured",return_value=True), \
                     patch("demo_email.configured",return_value=True), \
                     patch("demo_account_recovery.create_challenge") as send:
                    forgot=client.post("/demo/auth/password/forgot",json={"email":target_email})
                    magic=client.post("/demo/auth/magic/request",json={"email":target_email})
                    self.assertEqual(forgot.status_code,200,forgot.text)
                    self.assertEqual(magic.status_code,200,magic.text)
                    send.assert_not_called()
                reset=client.post("/demo/auth/password/reset",json={
                    "email":target_email,"code":"00000000",
                    "new_password":"not-allowed-to-change-123"})
                self.assertEqual(reset.status_code,400,reset.text)
                with SessionLocal() as db:
                    target=db.get(WebAccount,target_id)
                    self.assertEqual(target.password_hash,before)
                    with self.assertRaises(HTTPException) as error:
                        create_challenge(db,target,"login")
                    self.assertEqual(error.exception.detail,"account_banned")
        finally:
            for key,value in previous.items():
                if value is None:os.environ.pop(key,None)
                else:os.environ[key]=value


if __name__ == "__main__":
    unittest.main()
