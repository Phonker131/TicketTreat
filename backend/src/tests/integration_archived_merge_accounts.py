"""Archived Telegram-only merge sources are hidden, without deleting user history.

Disposable PostgreSQL only. Tests audited source->target proof, admin MFA,
archived lookup and role-write prevention; separate accounts remain visible.
"""
import base64
import os
import secrets
import time
import unittest
from datetime import timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient
if not os.getenv("DATABASE_URL","").endswith("/tickettreat_ci"):
    raise RuntimeError("Disposable PostgreSQL CI required")

import main
from db.session import SessionLocal
from demo_accounts import WebAccount,WebSession,token_hash
from demo_auth_security import hash_password
from demo_account_recovery import VerifiedEmail,now
from demo_mfa import _code
from demo_roles import AccountAdminAudit,WebAccountRole

class ArchivedAccountListTests(unittest.TestCase):
    def test_merged_shadow_hidden_with_audited_toggle_and_locked_role(self):
        password="ci-admin-password-2026!"
        with SessionLocal() as db:
            def new_account(name,email,hash_override=None):
                guest=main.DemoGuest(
                    access_token=secrets.token_urlsafe(32),first_name=name,
                    last_name="Test",email=email)
                db.add(guest);db.flush()
                account=WebAccount(
                    email=email,first_name=name,last_name="Test",
                    password_hash=hash_override or hash_password(password),
                    guest_id=guest.id,contact_preference="email" if email else "telegram")
                db.add(account);db.flush()
                db.add(WebAccountRole(account_id=account.id,role="participant"))
                return account

            admin=new_account("Admin",f"archived-admin-{secrets.token_hex(9)}@example.invalid")
            target=new_account("Target",f"merged-target-{secrets.token_hex(9)}@example.invalid")
            spare=new_account("Spare",f"independent-spare-{secrets.token_hex(9)}@example.invalid")
            shadow=new_account("Retired",None,"!telegram-only")
            untouched=new_account("Another",None,"!telegram-only")
            admin_id,target_id,spare_id,shadow_id,untouched_id=(
                admin.id,target.id,spare.id,shadow.id,untouched.id
            )
            db.add(VerifiedEmail(account_id=admin_id,verified_at=now()))
            bearer=secrets.token_urlsafe(36)
            db.add(WebSession(account_id=admin_id,token_hash=token_hash(bearer),
                expires_at=now()+timedelta(days=2)))
            db.add(AccountAdminAudit(
                actor_account_id=admin_id,target_account_id=target_id,
                action=f"manual_tg_shadow_{shadow_id}_to_{target_id}"))
            db.commit()
        with patch.dict(os.environ,{"GLOBAL_ADMIN_ACCOUNT_IDS":str(admin_id)}):
            with TestClient(main.app) as client:
                headers={"Authorization":"Bearer "+bearer}
                self.assertEqual(client.get("/demo/manage/accounts",headers=headers).status_code,403)
                start=client.post("/demo/auth/mfa/start",headers=headers,
                    json={"current_password":password})
                self.assertEqual(start.status_code,200,start.text)
                raw=start.json()["secret"]
                secret=base64.b32decode(raw+"="*((8-len(raw)%8)%8))
                confirm=client.post("/demo/auth/mfa/confirm",headers=headers,
                    json={"code":_code(secret,int(time.time())//30)})
                self.assertEqual(confirm.status_code,200,confirm.text)
                active=client.get("/demo/manage/accounts",headers=headers)
                self.assertEqual(active.status_code,200,active.text)
                visible={x["account_id"]:x for x in active.json()}
                self.assertNotIn(shadow_id,visible)
                self.assertIn(target_id,visible)
                self.assertIn(spare_id,visible)
                self.assertIn(untouched_id,visible)
                archived=client.get("/demo/manage/accounts?include_merged=true",headers=headers)
                self.assertEqual(archived.status_code,200,archived.text)
                all_rows={x["account_id"]:x for x in archived.json()}
                self.assertEqual(all_rows[shadow_id]["merged_into_account_id"],target_id)
                self.assertIsNone(all_rows[spare_id]["merged_into_account_id"])
                denied=client.put(f"/demo/manage/accounts/{shadow_id}/role",
                    headers=headers,json={"role":"organizer"})
                self.assertEqual(denied.status_code,409,denied.text)
                self.assertEqual(denied.json()["detail"],"merged_account_role_locked")
