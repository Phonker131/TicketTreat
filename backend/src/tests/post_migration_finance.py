"""Post-migration PostgreSQL integrity checks: disposable tickettreat_ci ONLY.

Run this suite only after backend/migrations/apply.py has installed database
triggers. The ordinary integration suite intentionally precedes migrations.
"""
import os
import secrets
import unittest
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

if not os.getenv("DATABASE_URL", "").endswith("/tickettreat_ci"):
    raise RuntimeError("Refusing post-migration finance test outside disposable CI DB")

from db.session import SessionLocal
from integration_pilot_ops import account_with_session
from demo_finance import (OrganizerContractVersion, OrganizerContractAcceptance,
                          FinanceAccessAudit, contract_digest)


class FinancePostMigrationIntegrity(unittest.TestCase):
    def test_financial_evidence_and_published_contracts_are_immutable(self):
        """Database triggers must protect evidence even if future API code errs."""
        from demo_finance import (FinanceLedgerEntry, FinanceDocument,
                                  OrganizerFinanceAudit)

        now = datetime.now(timezone.utc)
        with SessionLocal() as db:
            owner, _, _, _ = account_with_session(db, "organizer")
            owner_id = owner.id
            contract_body = "CI immutable agreement: " + secrets.token_hex(12)
            contract = OrganizerContractVersion(
                version="ci-immutable-" + secrets.token_hex(8), language="cs",
                body=contract_body, sha256=contract_digest(contract_body),
                status="published", published_at=now)
            ledger = FinanceLedgerEntry(
                owner_account_id=owner_id, category="sale", amount_minor=12500,
                currency="CZK", source="ci_immutable",
                source_key=secrets.token_hex(20), occurred_at=now)
            document = FinanceDocument(
                owner_account_id=owner_id, kind="ci_document",
                document_number="ci-" + secrets.token_hex(12),
                sha256="a" * 64, storage_key="ci/private-fixture", issued_at=now)
            profile_audit = OrganizerFinanceAudit(
                owner_account_id=owner_id, actor_account_id=owner_id,
                action="profile_updated")
            access_audit = FinanceAccessAudit(
                owner_account_id=owner_id, actor_account_id=owner_id,
                action="summary_viewed")
            db.add_all((contract, ledger, document, profile_audit, access_audit))
            db.flush()
            acceptance = OrganizerContractAcceptance(
                owner_account_id=owner_id, signer_account_id=owner_id,
                contract_id=contract.id, contract_sha256=contract.sha256,
                accepted_at=now)
            db.add(acceptance)
            db.commit()
            keys = {
                "tt_finance_ledger": ledger.id,
                "tt_finance_documents": document.id,
                "tt_finance_profile_audit": profile_audit.id,
                "tt_finance_access_audit": access_audit.id,
                "tt_organizer_contract_acceptances": acceptance.id,
            }
            contract_id = contract.id

        # These are deliberate failing SQL statements on disposable tickettreat_ci.
        # A future accidental UPDATE/DELETE endpoint cannot silently rewrite
        # provider evidence, archived document metadata, or contract acceptance.
        for table, pk in keys.items():
            for verb in ("UPDATE", "DELETE"):
                sql = (f"UPDATE {table} SET id=id WHERE id=:pk" if verb == "UPDATE"
                       else f"DELETE FROM {table} WHERE id=:pk")
                with self.subTest(table=table, action=verb):
                    with SessionLocal() as db:
                        with self.assertRaises(DBAPIError):
                            db.execute(text(sql), {"pk": pk})
                            db.commit()
        for sql in (
            "UPDATE tt_organizer_contract_versions SET body='tampered' WHERE id=:pk",
            "DELETE FROM tt_organizer_contract_versions WHERE id=:pk",
        ):
            with SessionLocal() as db:
                with self.assertRaises(DBAPIError):
                    db.execute(text(sql), {"pk": contract_id})
                    db.commit()

        with SessionLocal() as db:
            for table, pk in keys.items():
                self.assertEqual(db.scalar(text(
                    f"SELECT count(*) FROM {table} WHERE id=:pk"), {"pk": pk}), 1)
            saved = db.get(OrganizerContractVersion, contract_id)
            self.assertEqual(saved.body, contract_body)
            self.assertEqual(saved.sha256, contract_digest(contract_body))


