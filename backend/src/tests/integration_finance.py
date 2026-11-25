"""Finance tenant boundary tests — NEVER run outside disposable tickettreat_ci DB."""
import os
import secrets
import unittest
from datetime import datetime, timezone

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing finance integration test outside disposable CI DB")

from fastapi.testclient import TestClient
from db.session import SessionLocal
from integration_pilot_ops import account_with_session
from integration_organizer_rewards import enroll_mfa
from demo_organizer_teams import OrganizerTeamMember
from demo_finance import OrganizerContractVersion, OrganizerContractAcceptance, contract_digest
import main


class OrganizerFinanceIntegration(unittest.TestCase):
    def test_owner_only_no_historical_revenue_and_versioned_consent(self):
        with SessionLocal() as db:
            owner, _, password, owner_auth = account_with_session(db, "organizer")
            other, _, other_password, other_auth = account_with_session(db, "organizer")
            member, _, member_password, member_auth = account_with_session(db)
            db.add(OrganizerTeamMember(owner_account_id=owner.id,
                member_account_id=member.id,status="accepted",
                invited_at=datetime.now(timezone.utc),
                accepted_at=datetime.now(timezone.utc)))
            db.commit()
            owner_id = owner.id
            contract_body = "CI-only agreement: "+secrets.token_hex(12)

        with TestClient(main.app) as client:
            # Privileged organizer session must pass 2FA before touching finances.
            self.assertEqual(client.get("/demo/manage/finance/summary",
                headers=owner_auth).status_code,403)
            enroll_mfa(client,owner_auth,password)
            enroll_mfa(client,other_auth,other_password)
            enroll_mfa(client,member_auth,member_password)

            owner_summary=client.get("/demo/manage/finance/summary?month=2026-11",
                headers=owner_auth)
            self.assertEqual(owner_summary.status_code,200,owner_summary.text)
            self.assertEqual(owner_summary.json()["summary"]["gross_sales_minor"],0)
            self.assertIsNone(owner_summary.json()["summary"]["verified_tax_minor"])
            for endpoint in (
                f"/demo/manage/finance/summary?organization_id={owner_id}",
                f"/demo/manage/finance/entries?organization_id={owner_id}",
                f"/demo/manage/finance/export?organization_id={owner_id}",
                f"/demo/manage/finance/documents?organization_id={owner_id}",
                f"/demo/manage/finance/contract?organization_id={owner_id}",
            ):
                self.assertEqual(client.get(endpoint,headers=other_auth).status_code,403,endpoint)
                self.assertEqual(client.get(endpoint,headers=member_auth).status_code,403,endpoint)
            self.assertEqual(client.get("/demo/manage/finance/profile",
                headers=member_auth).status_code,403)

            updated=client.put("/demo/manage/finance/profile",headers=owner_auth,
                json={"legal_name":"Test Event Organizer s.r.o.","ico":"12345678",
                      "dic":"CZ12345678","vat_status":"payer"})
            self.assertEqual(updated.status_code,200,updated.text)
            self.assertFalse(updated.json()["verified"])
            self.assertFalse(updated.json()["charges_enabled"])
            self.assertFalse(updated.json()["payouts_enabled"])
            self.assertEqual(client.put("/demo/manage/finance/profile",
                headers=member_auth,json={"legal_name":"Impersonated Organizer",
                  "ico":"12345678","vat_status":"payer"}).status_code,403)
            self.assertEqual(client.post("/demo/manage/finance/contract/accept",
                headers=owner_auth,json={"contract_id":999999,
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
                    "confirm_authority":True}).status_code,403)
            accepted=client.post("/demo/manage/finance/contract/accept",
                headers=owner_auth,json={"contract_id":contract_id,
                    "digest":contract_digest(contract_body),
                    "confirm_authority":True})
            self.assertEqual(accepted.status_code,200,accepted.text)
            self.assertEqual(accepted.json()["signature_method"],"web_mfa_ack")
            self.assertEqual(client.post("/demo/manage/finance/contract/accept",
                headers=owner_auth,json={"contract_id":contract_id,
                    "digest":contract_digest(contract_body),
                    "confirm_authority":True}).json()["status"],"already_accepted")
            with SessionLocal() as db:
                record=db.query(OrganizerContractAcceptance).filter(
                    OrganizerContractAcceptance.owner_account_id==owner_id,
                    OrganizerContractAcceptance.contract_id==contract_id).first()
                self.assertIsNotNone(record)
                self.assertEqual(record.contract_sha256,contract_digest(contract_body))


if __name__ == "__main__":
    unittest.main()
