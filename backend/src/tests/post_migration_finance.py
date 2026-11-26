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
                          FinanceAccessAudit, OrganizerExpenseEntry, contract_digest)


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
            expense = OrganizerExpenseEntry(
                owner_account_id=owner_id, actor_account_id=owner_id,
                entry_type="expense", category="venue", amount_minor=123400,
                currency="CZK", expense_date=now.date(), supplier="CI venue")
            db.add_all((contract, ledger, document, profile_audit, access_audit, expense))
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
                "tt_finance_expense_entries": expense.id,
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

    def test_database_rejects_cross_owner_event_and_invalid_expense_reversal(self):
        """Mistakes in future ingestion must not change the beneficiary of data."""
        from demo_finance import FinanceLedgerEntry
        from demo_roles import EventOwnership
        from db.models import Event

        now = datetime.now(timezone.utc)
        with SessionLocal() as db:
            owner, _, _, _ = account_with_session(db, "organizer")
            stranger, _, _, _ = account_with_session(db, "organizer")
            event = Event(title="CI financial ownership boundary", starts_at=now)
            db.add(event);db.flush()
            db.add(EventOwnership(event_id=event.id, owner_account_id=owner.id))
            db.flush()  # The expense INSERT trigger must see the ownership row.
            expense = OrganizerExpenseEntry(
                owner_account_id=owner.id, actor_account_id=owner.id,
                event_id=event.id, entry_type="expense", category="venue",
                amount_minor=75000, currency="CZK", expense_date=now.date())
            db.add(expense);db.commit()
            event_id, expense_id = event.id, expense.id
            owner_id, stranger_id = owner.id, stranger.id

        with SessionLocal() as db, self.assertRaises(DBAPIError):
            db.add(FinanceLedgerEntry(
                owner_account_id=stranger_id, event_id=event_id,
                category="sale", amount_minor=75000, currency="CZK",
                source="ci_owner_guard", source_key=secrets.token_hex(12),
                occurred_at=now))
            db.commit()

        # The owner-event constraint also applies to self-reported costs.
        with SessionLocal() as db, self.assertRaises(DBAPIError):
            db.add(OrganizerExpenseEntry(
                owner_account_id=stranger_id, actor_account_id=stranger_id,
                event_id=event_id, entry_type="expense", category="venue",
                amount_minor=50000, currency="CZK", expense_date=now.date()))
            db.commit()

        # Even someone with direct SQL INSERT cannot reverse another owner's
        # cost, alter its currency/amount, or create a fabricated correction.
        with SessionLocal() as db, self.assertRaises(DBAPIError):
            db.add(OrganizerExpenseEntry(
                owner_account_id=stranger_id, actor_account_id=stranger_id,
                event_id=event_id, entry_type="reversal", reverses_entry_id=expense_id,
                category="venue", amount_minor=-75000, currency="CZK",
                expense_date=now.date(), note="forged reversal"))
            db.commit()
        with SessionLocal() as db, self.assertRaises(DBAPIError):
            db.add(OrganizerExpenseEntry(
                owner_account_id=owner_id, actor_account_id=owner_id,
                event_id=event_id, entry_type="reversal", reverses_entry_id=expense_id,
                category="venue", amount_minor=-1, currency="CZK",
                expense_date=now.date(), note="wrong amount"))
            db.commit()


