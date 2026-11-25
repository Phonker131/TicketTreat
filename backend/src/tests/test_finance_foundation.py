"""No database, Stripe or payment environment needed for these calculations."""
import unittest
import os
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException, Request
from pydantic import ValidationError

from demo_finance import (FinanceMFAProof, UpdateFinanceProfile, contract_digest,
                          finance_csv_reference, month_bounds, totals,
                          trusted_ip_fingerprint)


class FinanceFoundationTests(unittest.TestCase):
    def test_prague_local_month_accounts_for_dst(self):
        month, begin, end = month_bounds("2027-03")
        self.assertEqual(month, "2027-03")
        self.assertEqual(begin, datetime(2027, 2, 28, 23, tzinfo=timezone.utc))
        self.assertEqual(end, datetime(2027, 3, 31, 22, tzinfo=timezone.utc))

    def test_invalid_month_rejected(self):
        for value in ["2027-00", "2027-13", "2026-1", "2025-12", "3020-12"]:
            with self.subTest(value=value), self.assertRaises(HTTPException) as issue:
                month_bounds(value)
            self.assertEqual(issue.exception.status_code, 422)

    def test_empty_data_does_not_invent_tax_or_revenue(self):
        result = totals([])
        self.assertEqual(result["gross_sales_minor"], 0)
        self.assertEqual(result["platform_fee_minor"], 0)
        self.assertIsNone(result["verified_tax_minor"])
        self.assertIsNone(result["net_after_verified_tax_minor"])
        self.assertFalse(result["tax_is_complete"])

    def test_separates_sales_refunds_processor_fees_and_payouts(self):
        entries = [
            SimpleNamespace(category="sale", amount_minor=10_000, verified_tax_minor=1_735),
            SimpleNamespace(category="refund", amount_minor=-1_000, verified_tax_minor=-174),
            SimpleNamespace(category="stripe_fee", amount_minor=-300, verified_tax_minor=None),
            SimpleNamespace(category="payout", amount_minor=-8_700, verified_tax_minor=None),
        ]
        result = totals(entries)
        self.assertEqual(result["gross_sales_minor"], 10_000)
        self.assertEqual(result["refunds_minor"], 1_000)
        self.assertEqual(result["stripe_fees_minor"], 300)
        self.assertEqual(result["payouts_minor"], 8_700)
        self.assertEqual(result["net_after_processing_minor"], 8_700)
        self.assertEqual(result["verified_tax_minor"], 1_561)
        self.assertEqual(result["net_after_verified_tax_minor"], 7_139)

    def test_partial_tax_evidence_not_treated_as_complete(self):
        entries = [
            SimpleNamespace(category="sale", amount_minor=10_000, verified_tax_minor=1_735),
            SimpleNamespace(category="refund", amount_minor=-1_000, verified_tax_minor=None),
        ]
        self.assertIsNone(totals(entries)["verified_tax_minor"])

    def test_contract_digest_is_sha256_of_exact_version(self):
        self.assertEqual(len(contract_digest("Návrh smlouvy v1")), 64)
        self.assertNotEqual(contract_digest("one"), contract_digest("one "))

    def test_export_reference_is_text_even_for_unicode_and_formula_payloads(self):
        for raw in ["=HYPERLINK(1)", "\t+SUM(1,2)", "\u200b@cmd",
                    "\r=cmd\n-evil", "order-123"]:
            with self.subTest(raw=raw):
                safe=finance_csv_reference(raw)
                self.assertTrue(safe.startswith("'"))
                self.assertNotIn("\r",safe)
                self.assertNotIn("\n",safe)
        self.assertEqual(finance_csv_reference(None),"")

    def test_organizer_cannot_mass_assign_stripe_or_payout_fields(self):
        with self.assertRaises(ValidationError):
            UpdateFinanceProfile(legal_name="Example s.r.o.",ico="12345678",
                                 vat_status="payer",mfa_code="123456",
                                 stripe_account_id="acct_attacker",payouts_enabled=True)

    def test_otp_codes_accept_ascii_digits_only(self):
        self.assertEqual(FinanceMFAProof(mfa_code="123456").mfa_code,"123456")
        with self.assertRaises(ValidationError):
            FinanceMFAProof(mfa_code="１２３４５６")
        with self.assertRaises(ValidationError):
            FinanceMFAProof(mfa_code="١٢٣٤٥٦")

    def test_audit_fingerprint_never_contains_raw_ip(self):
        request=Request({"type":"http","client":("203.0.113.7",54321),"headers":[]})
        with patch.dict(os.environ,{"FINANCE_AUDIT_HMAC_KEY":"a"*40,
                                     "TICKETTREAT_GATEWAY_IP_SECRET":""}):
            first=trusted_ip_fingerprint(request)
            self.assertIsNotNone(first)
            self.assertEqual(len(first),64)
            self.assertNotIn("203.0.113.7",first)
            self.assertEqual(first,trusted_ip_fingerprint(request))
        with patch.dict(os.environ,{"FINANCE_AUDIT_HMAC_KEY":"",
                                     "TICKETTREAT_GATEWAY_IP_SECRET":""}):
            self.assertIsNone(trusted_ip_fingerprint(request))


if __name__ == "__main__":
    unittest.main()
