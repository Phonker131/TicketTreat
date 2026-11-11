"""Cross-channel concurrent first Telegram login must resolve one principal.

Disposable PostgreSQL only. Every provider proof is from a mocked, CI-only
signed Telegram launch or the same verified helper used by OIDC.
"""
import os
import secrets
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from fastapi.testclient import TestClient

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing Telegram race test against non-CI database")

import main
from db.session import SessionLocal
from demo_accounts import AuthIdentity, WebAccount
from demo_telegram import DemoTelegramIdentity
from demo_telegram_oidc import ensure_telegram_web_account
from integration_telegram_browser_link import BOT_TOKEN,signed_init_data


class TelegramPrincipalConcurrencyTests(unittest.TestCase):
    def test_miniapp_and_oidc_first_login_share_one_guest_and_account(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        with patch.dict(os.environ,{
            "TELEGRAM_MINIAPP_BOT_TOKEN":BOT_TOKEN,
            "TICKETTREAT_IDENTITY_REGISTRY_MODE":"shadow",
        }), TestClient(main.app) as client:
            def first_login(n:int)->int:
                if n%2:
                    response=client.post("/demo/telegram/auth",json={
                        "init_data":signed_init_data(telegram_id),
                    })
                    if response.status_code!=200:
                        raise AssertionError(response.text)
                    return int(response.json()["guest"]["id"])
                with SessionLocal() as db:
                    account=ensure_telegram_web_account(
                        db, main.DemoGuest, {
                            "id": telegram_id, "given_name":"Verified Telegram",
                        },reconcile=False,
                    )
                    return account.guest_id

            with ThreadPoolExecutor(max_workers=8) as pool:
                guest_ids=list(pool.map(first_login,range(16)))
            self.assertEqual(len(set(guest_ids)),1)
            guest_id=guest_ids[0]
            with SessionLocal() as db:
                self.assertEqual(db.query(DemoTelegramIdentity).filter(
                    DemoTelegramIdentity.telegram_id==telegram_id,
                    DemoTelegramIdentity.guest_id==guest_id,
                ).count(),1)
                account=db.query(WebAccount).filter(WebAccount.guest_id==guest_id).one()
                self.assertIsNone(account.email)
                self.assertEqual(db.query(AuthIdentity).filter(
                    AuthIdentity.provider=="telegram",
                    AuthIdentity.provider_subject==str(telegram_id),
                    AuthIdentity.account_id==account.id,
                ).count(),1)
                self.assertEqual(db.query(WebAccount).filter(
                    WebAccount.guest_id==guest_id,
                ).count(),1)


if __name__=="__main__":
    unittest.main()
