"""Finance tenant boundary tests — NEVER run outside disposable tickettreat_ci DB."""
import os
import secrets
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing finance integration test outside disposable CI DB")

from fastapi.testclient import TestClient
from db.session import SessionLocal
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa
from demo_roles import GlobalAdminDelegation, role_for
from demo_organizer_teams import OrganizerTeamMember
from demo_finance import (OrganizerContractVersion, OrganizerContractAcceptance,
                          FinanceAccessAudit, FinanceSessionGrant, PRAGUE, contract_digest)
from demo_mfa import MFAFactor, cipher, _code
from demo_accounts import WebSession, token_hash
from demo_account_bans import PermanentAccountBan
import main


class OrganizerFinanceIntegration(unittest.TestCase):
    def finance_step(self, client, headers, index, path, payload):
        """Advance only the TOTP clock; never wait or use production secrets."""
        with SessionLocal() as db:
            session_hash=token_hash(headers["Authorization"][7:])
            session=db.query(WebSession).filter(WebSession.token_hash==session_hash).first()
            factor=db.get(MFAFactor,session.account_id)
            secret=cipher().decrypt(factor.encrypted_secret)
        counter=int(time.time())//30+index
        code=_code(secret,counter)
        # The finance route captured the imported validator in its closure at
        # app installation, so patch the validator's clock, not its import.
        with patch("demo_mfa.time.time",return_value=counter*30):
            return client.post(path,headers=headers,json={**payload,"mfa_code":code})

    def test_owner_only_no_historical_revenue_and_versioned_consent(self):
        with SessionLocal() as db:
            owner, _, password, owner_auth = account_with_session(db, "organizer")
            other, _, other_password, other_auth = account_with_session(db, "organizer")
            member, _, member_password, member_auth = account_with_session(db)
            db.add(OrganizerTeamMember(owner_account_id=owner.id,
                member_account_id=member.id,status="active",
                invited_at=datetime.now(timezone.utc),
                accepted_at=datetime.now(timezone.utc)))
            # Exercise actual delegated-admin resolution, not a mocked role.
            db.add(GlobalAdminDelegation(account_id=other.id,email=other.email,
                                         granted_by=owner.id))
            db.commit()
            self.assertEqual(role_for(db,other),"global_admin")
            owner_id = owner.id
            contract_body = "CI-only agreement: "+secrets.token_hex(12)

        with TestClient(main.app) as client:
            # Privileged organizer session must pass 2FA before touching finances.
            self.assertEqual(client.get("/demo/manage/finance/summary",
                headers=owner_auth).status_code,403)
            enroll_mfa(client,owner_auth,password)
            enroll_mfa(client,other_auth,other_password)
            enroll_mfa(client,member_auth,member_password)

            locked=client.get("/demo/manage/finance/summary?month=2026-11",headers=owner_auth)
            self.assertEqual(locked.status_code,403,locked.text)
            self.assertEqual(locked.json()["detail"],"finance_unlock_required")
            self.assertFalse(client.get("/demo/manage/finance/status",headers=owner_auth).json()["unlocked"])
            self.assertEqual(self.finance_step(client,owner_auth,1,
                "/demo/manage/finance/unlock",{}).status_code,200)
            self.assertEqual(self.finance_step(client,other_auth,1,
                "/demo/manage/finance/unlock",{}).status_code,200)
            self.assertTrue(client.get("/demo/manage/finance/status",headers=owner_auth).json()["unlocked"])
            owner_summary=client.get("/demo/manage/finance/summary?month=2026-11",
                headers=owner_auth)
            self.assertEqual(owner_summary.status_code,200,owner_summary.text)
            self.assertEqual(owner_summary.json()["summary"]["gross_sales_minor"],0)
            self.assertIsNone(owner_summary.json()["summary"]["verified_tax_minor"])
            for endpoint in (
                f"/demo/manage/finance/summary?organization_id={owner_id}",
                f"/demo/manage/finance/entries?organization_id={owner_id}",
                f"/demo/manage/finance/documents?organization_id={owner_id}",
                f"/demo/manage/finance/contract?organization_id={owner_id}",
            ):
                self.assertEqual(client.get(endpoint,headers=other_auth).json()["detail"],
                                 "finance_owner_required",endpoint)
                self.assertEqual(client.get(endpoint,headers=member_auth).status_code,403,endpoint)
            # Exports are POST-only, so test the cross-owner boundary with the
            # actual export method (before any MFA code can be consumed).
            cross_export={"organization_id":owner_id,"month":"2026-11",
                          "currency":"CZK","mfa_code":"000000"}
            self.assertEqual(client.post("/demo/manage/finance/export",
                headers=other_auth,json=cross_export).json()["detail"],"finance_owner_required")
            self.assertEqual(client.post("/demo/manage/finance/export",
                headers=member_auth,json=cross_export).status_code,403)
            # Even a real global-admin delegation cannot bypass seller isolation.
            self.assertEqual(client.get(
                f"/demo/manage/finance/summary?organization_id={owner_id}",
                headers=other_auth).status_code,403)
            self.assertEqual(client.get("/demo/manage/finance/profile",
                headers=member_auth).status_code,403)

            # An attacker cannot inject a connected Stripe account or enable payouts.
            tamper=client.put("/demo/manage/finance/profile",headers=owner_auth,
                json={"legal_name":"Test Event Organizer s.r.o.","ico":"00177041",
                      "vat_status":"payer","stripe_account_id":"acct_attacker","mfa_code":"000000"})
            self.assertEqual(tamper.status_code,422,tamper.text)
            # Fresh OTP proof also applies to PUT; used unlock codes never replay.
            updated_payload={"legal_name":"Test Event Organizer s.r.o.","ico":"00177041",
                            "dic":"CZ00177041","vat_status":"payer"}
            with SessionLocal() as db:
                actor = db.query(WebSession).filter(
                    WebSession.token_hash==token_hash(owner_auth["Authorization"][7:])).first()
                secret = cipher().decrypt(db.get(MFAFactor,actor.account_id).encrypted_secret)
            replay_counter=int(time.time())//30+1
            reused_code = _code(secret,replay_counter)
            with patch("demo_mfa.time.time",return_value=replay_counter*30):
                replay=client.put("/demo/manage/finance/profile",headers=owner_auth,
                    json={**updated_payload,"mfa_code":reused_code})
            self.assertEqual(replay.status_code,401,replay.text)
            # Test the intended update separately with the next real code.
            update_counter=int(time.time())//30+2
            with patch("demo_mfa.time.time",return_value=update_counter*30):
                updated=client.put("/demo/manage/finance/profile",headers=owner_auth,
                    json={**updated_payload,"mfa_code":_code(secret,update_counter)})
            self.assertEqual(updated.status_code,200,updated.text)
            self.assertFalse(updated.json()["verified"])
            self.assertFalse(updated.json()["charges_enabled"])
            self.assertFalse(updated.json()["payouts_enabled"])
            self.assertEqual(client.put("/demo/manage/finance/profile",
                headers=member_auth,json={"legal_name":"Impersonated Organizer",
                  "ico":"00177041","vat_status":"payer","mfa_code":"000000"}).status_code,403)
            export=self.finance_step(client,owner_auth,3,"/demo/manage/finance/export",
                                     {"month":"2026-11","currency":"CZK"})
            self.assertEqual(export.status_code,200,export.text)
            self.assertTrue(export.json()["csv"].startswith("id,date_utc,"))
            self.assertEqual(client.get("/demo/manage/finance/export",headers=owner_auth).status_code,405)
            self.assertEqual(self.finance_step(client,owner_auth,3,
                "/demo/manage/finance/export",{"month":"2026-11"}).status_code,401)
            self.assertEqual(self.finance_step(client,owner_auth,4,
                "/demo/manage/finance/contract/accept",{"contract_id":999999,
                "digest":"0"*64,"confirm_authority":True}).status_code,409)

            with SessionLocal() as db:
                contract=OrganizerContractVersion(version="ci-"+secrets.token_hex(8),
                    language="cs",body=contract_body,sha256=contract_digest(contract_body),
                    status="published",published_at=datetime.now(timezone.utc))
                db.add(contract);db.commit()
                contract_id=contract.id
            self.assertEqual(client.post("/demo/manage/finance/contract/accept",
                headers=member_auth,json={"contract_id":contract_id,
                    "digest":contract_digest(contract_body),
                    "confirm_authority":True,"mfa_code":"000000"}).status_code,403)
            accepted=self.finance_step(client,owner_auth,4,
                "/demo/manage/finance/contract/accept",{"contract_id":contract_id,
                    "digest":contract_digest(contract_body),"confirm_authority":True})
            self.assertEqual(accepted.status_code,200,accepted.text)
            self.assertEqual(accepted.json()["signature_method"],"web_mfa_ack")
            self.assertEqual(self.finance_step(client,owner_auth,5,
                "/demo/manage/finance/contract/accept",{"contract_id":contract_id,
                    "digest":contract_digest(contract_body),
                    "confirm_authority":True}).json()["status"],"already_accepted")

            with SessionLocal() as db:
                record=db.query(OrganizerContractAcceptance).filter(
                    OrganizerContractAcceptance.owner_account_id==owner_id,
                    OrganizerContractAcceptance.contract_id==contract_id).first()
                self.assertIsNotNone(record)
                self.assertEqual(record.contract_sha256,contract_digest(contract_body))
                audit=db.query(FinanceAccessAudit).filter(
                    FinanceAccessAudit.owner_account_id==owner_id).all()
                self.assertTrue(any(row.action=="contract_accepted" for row in audit))
                self.assertTrue(any(row.action=="summary_viewed" for row in audit))
                self.assertTrue(any(row.action=="csv_exported" for row in audit))
                # A permanent ban overrides an existing 15-minute unlock.
                db.add(PermanentAccountBan(account_id=owner_id,reason="CI finance ban regression"))
                db.commit()
            blocked=client.get("/demo/manage/finance/status",headers=owner_auth)
            self.assertEqual(blocked.status_code,403,blocked.text)
            self.assertEqual(blocked.json()["detail"],"account_banned")
            with SessionLocal() as db:
                other_key=token_hash(other_auth["Authorization"][7:])
                grant=db.get(FinanceSessionGrant,other_key)
                self.assertIsNotNone(grant)
                grant.granted_at=datetime.now(timezone.utc)-timedelta(minutes=30)
                grant.expires_at=datetime.now(timezone.utc)-timedelta(minutes=1)
                db.commit()
            self.assertEqual(client.get("/demo/manage/finance/summary",
                headers=other_auth).json()["detail"],"finance_unlock_required")
            # Deleting a web session denies finance even while unlock row remains.
            with SessionLocal() as db:
                db.query(WebSession).filter(
                    WebSession.token_hash==token_hash(other_auth["Authorization"][7:])).delete()
                db.commit()
            self.assertEqual(client.get("/demo/manage/finance/status",
                headers=other_auth).status_code,401)

    def test_manual_expenses_are_owner_scoped_and_corrected_immutably(self):
        """Independent finance account avoids bypassing the 8-OTP/15min limit."""
        with SessionLocal() as db:
            owner, _, owner_password, owner_auth = account_with_session(db, "organizer")
            other, _, other_password, other_auth = account_with_session(db, "organizer")
            member, _, _, member_auth = account_with_session(db)
            db.add(OrganizerTeamMember(owner_account_id=owner.id,
                member_account_id=member.id,status="active",
                invited_at=datetime.now(timezone.utc),
                accepted_at=datetime.now(timezone.utc)))
            db.add(GlobalAdminDelegation(account_id=other.id,email=other.email,
                                         granted_by=owner.id))
            db.commit()
            owner_id, other_id = owner.id, other.id

        local_today=datetime.now(PRAGUE).date()
        expense_month=local_today.strftime("%Y-%m")
        expense_payload={"expense_date":local_today.isoformat(),"category":"venue",
            "amount_minor":120000,"currency":"CZK","supplier":"Venue s.r.o.",
            "reference":"=HYPERLINK(1)","note":"Rental deposit"}
        with TestClient(main.app) as client:
            enroll_mfa(client,owner_auth,owner_password)
            enroll_mfa(client,other_auth,other_password)
            self.assertEqual(self.finance_step(client,owner_auth,1,
                "/demo/manage/finance/unlock",{}).status_code,200)
            self.assertEqual(self.finance_step(client,other_auth,1,
                "/demo/manage/finance/unlock",{}).status_code,200)
            forged=client.post("/demo/manage/finance/expenses",headers=owner_auth,
                json={**expense_payload,"owner_account_id":other_id,
                      "mfa_code":"000000"})
            self.assertEqual(forged.status_code,422,forged.text)
            created=self.finance_step(client,owner_auth,2,
                "/demo/manage/finance/expenses",expense_payload)
            self.assertEqual(created.status_code,200,created.text)
            self.assertEqual(created.json()["status"],"self_reported")
            expense_id=created.json()["entry"]["id"]
            details=client.get(f"/demo/manage/finance/expenses?month={expense_month}&currency=CZK",
                headers=owner_auth)
            self.assertEqual(details.status_code,200,details.text)
            self.assertEqual(details.json()["summary"]["manual_expenses_minor"],120000)
            self.assertEqual(details.json()["summary"]["by_category"]["venue"],120000)
            self.assertEqual(client.get(f"/demo/manage/finance/expenses?month={expense_month}",
                headers=other_auth,params={"organization_id":owner_id}).status_code,403)
            self.assertEqual(client.get(f"/demo/manage/finance/expenses?month={expense_month}",
                headers=member_auth).status_code,403)
            self.assertEqual(client.get(f"/demo/manage/finance/summary?month={expense_month}",
                headers=owner_auth).json()["summary"]["gross_sales_minor"],0)
            expense_export=self.finance_step(client,owner_auth,3,
                "/demo/manage/finance/expenses/export",{"month":expense_month,"currency":"CZK"})
            self.assertEqual(expense_export.status_code,200,expense_export.text)
            self.assertFalse(expense_export.json()["verified"])
            self.assertIn("'=HYPERLINK(1)",expense_export.json()["csv"])
            reversed_row=self.finance_step(client,owner_auth,4,
                f"/demo/manage/finance/expenses/{expense_id}/reverse",
                {"reason":"Duplicate supplier bill"})
            self.assertEqual(reversed_row.status_code,200,reversed_row.text)
            self.assertEqual(reversed_row.json()["entry"]["amount_minor"],-120000)
            self.assertEqual(reversed_row.json()["entry"]["reverses_entry_id"],expense_id)
            details_after=client.get(f"/demo/manage/finance/expenses?month={expense_month}",
                headers=owner_auth).json()
            self.assertEqual(details_after["summary"]["manual_expenses_minor"],0)
            self.assertTrue(any(row["id"]==expense_id and row["reversed"]
                                for row in details_after["entries"]))
            with SessionLocal() as db:
                audit=db.query(FinanceAccessAudit).filter(
                    FinanceAccessAudit.owner_account_id==owner_id).all()
                self.assertTrue(any(row.action=="expense_recorded" for row in audit))
                self.assertTrue(any(row.action=="expense_reversed" for row in audit))



if __name__ == "__main__":
    unittest.main()
