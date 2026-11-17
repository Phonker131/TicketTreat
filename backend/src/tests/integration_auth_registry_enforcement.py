"""Explicit enforce-mode provider resolution on disposable CI PostgreSQL."""
import os
import secrets
import unittest
from datetime import datetime,timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Registry enforcement tests refuse a production database")

import main
from db.session import SessionLocal
from demo_accounts import AuthIdentity, WebAccount
from demo_telegram import DemoTelegramIdentity
from demo_identity_registry import (
    authenticated_provider_account, claim_verified_identity, require_registry_owner,
)
from integration_telegram_browser_link import BOT_TOKEN,signed_init_data,website_account


class RegistryEnforcementTests(unittest.TestCase):
    def test_verified_password_account_fails_closed_until_email_ledger_is_backfilled(self):
        account_id,guest_id,_=website_account()
        with SessionLocal() as db:
            email=db.get(WebAccount,account_id).email
        with patch.dict(os.environ,{"TICKETTREAT_IDENTITY_REGISTRY_MODE":"enforce"}), \
             TestClient(main.app) as client:
            credential={"email":email,"password":"not-a-real-password-1234"}
            blocked=client.post("/demo/auth/login",json=credential)
            self.assertEqual(blocked.status_code,409,blocked.text)
            self.assertEqual(blocked.json()["detail"],"verified_identity_registry_backfill_required")
            with SessionLocal() as db:
                claim_verified_identity(db,account_id=account_id,
                                        provider="email",verified_subject=email)
                db.commit()
            allowed=client.post("/demo/auth/login",json=credential)
            self.assertEqual(allowed.status_code,200,allowed.text)
            self.assertEqual(allowed.json()["profile"]["account"]["id"],account_id)

    def test_registry_is_authoritative_over_conflicting_legacy_email_owner(self):
        original,_,_=website_account()
        mismatch,_,_=website_account()
        with SessionLocal() as db:
            email=db.get(WebAccount,original).email
            # Simulate an improperly imported ledger row, not a user action.
            claim_verified_identity(db,account_id=mismatch,
                                    provider="email",verified_subject=email)
            db.commit()
        with patch.dict(os.environ,{"TICKETTREAT_IDENTITY_REGISTRY_MODE":"enforce"}), \
             TestClient(main.app) as client:
            response=client.post("/demo/auth/login",json={
                "email":email,"password":"not-a-real-password-1234",
            })
            self.assertEqual(response.status_code,409,response.text)
            self.assertEqual(response.json()["detail"],"verified_identity_owner_mismatch")

    def test_signed_first_telegram_login_claims_new_verified_ledger_and_reuses_account(self):
        telegram_id=secrets.randbelow(10**12)+10**10
        with patch.dict(os.environ,{
            "TELEGRAM_MINIAPP_BOT_TOKEN":BOT_TOKEN,
            "TICKETTREAT_IDENTITY_REGISTRY_MODE":"enforce",
        }),TestClient(main.app) as client:
            first=client.post("/demo/telegram/auth",json={
                "init_data":signed_init_data(telegram_id),
            })
            self.assertEqual(first.status_code,200,first.text)
            guest_id=first.json()["guest"]["id"]
            second=client.post("/demo/telegram/auth",json={
                "init_data":signed_init_data(telegram_id),
            })
            self.assertEqual(second.status_code,200,second.text)
            self.assertEqual(second.json()["guest"]["id"],guest_id)
            with SessionLocal() as db:
                account=db.query(WebAccount).filter(WebAccount.guest_id==guest_id).one()
                resolved=authenticated_provider_account(db,"telegram",str(telegram_id))
                self.assertEqual(resolved.id,account.id)
                self.assertEqual(db.get(DemoTelegramIdentity,telegram_id).guest_id,guest_id)

    def test_missing_telegram_mapping_leaves_no_new_guest(self):
        account_id, _, _ = website_account()
        telegram_id = secrets.randbelow(10**12) + 10**10
        with SessionLocal() as db:
            claim_verified_identity(db, account_id=account_id,
                                    provider="telegram", verified_subject=str(telegram_id))
            db.commit()
        with patch.dict(os.environ, {
            "TELEGRAM_MINIAPP_BOT_TOKEN": BOT_TOKEN,
            "TICKETTREAT_IDENTITY_REGISTRY_MODE": "enforce",
        }), TestClient(main.app) as client:
            response = client.post("/demo/telegram/auth", json={
                "init_data": signed_init_data(telegram_id),
            })
            self.assertEqual(response.status_code, 409, response.text)
            with SessionLocal() as db:
                self.assertIsNone(db.get(DemoTelegramIdentity, telegram_id))
                self.assertIsNone(db.query(main.DemoGuest.id).filter_by(
                    telegram_id=telegram_id).first())
                self.assertEqual(authenticated_provider_account(
                    db, "telegram", str(telegram_id)).id, account_id)

    def test_google_registry_subject_resolves_to_one_proved_owner(self):
        account_id,_,_=website_account()
        subject="google-ci-"+secrets.token_hex(10)
        with SessionLocal() as db:
            claim_verified_identity(db,account_id=account_id,
                                    provider="google",verified_subject=subject)
            db.commit()
        with patch.dict(os.environ,{"TICKETTREAT_IDENTITY_REGISTRY_MODE":"enforce"}):
            with SessionLocal() as db:
                known=authenticated_provider_account(db,"google",subject)
                self.assertEqual(known.id,account_id)
                require_registry_owner(db,provider="google",verified_subject=subject,
                                       legacy_account_id=account_id)
                with self.assertRaises(HTTPException) as caught:
                    require_registry_owner(db,provider="google",verified_subject=subject,
                                           legacy_account_id=account_id+999999)
                self.assertEqual(caught.exception.status_code,409)


if __name__=="__main__":
    unittest.main()
