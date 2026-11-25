# TicketTreat — finance security & bookkeeping audit (25 Nov 2026)

**Review branch:** `feature/finance-legal-foundation`, draft PR #215.
**Release state:** no merge, production deploy, production migration, live Stripe payments, payouts, invoices or EET submissions. This is a **code-level and isolated-CI review**, not a professional penetration test, financial audit or legal opinion.

## Reviewed attack surfaces

- FastAPI `/demo/manage/finance/*` (also routed through `/api/v1/`), Next.js finance UI and gateway session handling.
- Account/role/owner checks, permanent bans and token revocation on each finance call.
- Separate session-bound finance MFA unlock, fresh TOTP for writes and exports, rate limits and private security alerts.
- PostgreSQL tenant boundaries, append-only records, contract version hashes, document metadata, request audit.
- CSV injection and input validation; manual expenses, reversals and event association.
- Unit, database, end-to-end, migration, backup/restore security gates.

## Findings and disposition

| Priority | Finding | Mitigation in this branch | Residual |
| --- | --- | --- | --- |
| High | Future provider ledger could accept an `event_id` owned by another seller if a backend writer used the wrong `owner_account_id`. | New PostgreSQL INSERT guard rejects cross-owner event links; separate tests exercise forged provider rows. | Future Stripe reconciliation still must validate connected account, event, amount, currency, order and source signature. |
| Medium | A 15-minute server finance unlock did not automatically hide already rendered financial data in an idle browser tab. | UI now clears finance state when the grant expires, and re-checks when the tab's visibility changes. | Compromised/unlocked devices remain a risk; the backend independently enforces sessions/MFA. |
| Medium | Seller IČO field checked length only, allowing common mistypes. | Added offline Czech 8-digit control-digit validation and regression tests. | IČO existence, VAT registration, owner/signatory authority and Stripe KYC remain unverified. |
| Medium | Organizers needed a safe way to prepare expense records before any payment provider data exists. | Separate owner-scoped manual expense journal, fresh MFA, bounded fields/amounts, category/event validation, immutable reversals, private CSV and clearly unverified totals. | Supplier invoices/receipts are not archived or tax-verified; this is **not** automated tax calculation. |
| Medium | Corrections could lose a row-level lock if made before the existing rate counter committed. | Expense reversal flow completes rate counter and MFA before taking the source expense's `FOR UPDATE` lock. PostgreSQL has a uniqueness constraint on reversals. | Test concurrent requests and worker failures again in staging. |
| Existing control | Old bearer tokens, permanent bans, cross-organization reads, admin delegation and OTP replay. | Canonical web session, ban and role checks on every call; owner-only data; 15-minute unlock, single-use TOTP, audit and alerts. | Independent penetration test and production least-privilege review required. |
| Existing control | Financial record/contract retroactive rewriting. | PostgreSQL UPDATE/DELETE triggers, SHA-256 contract digest, append-only access/expense audit and correction entries. | Database superusers can disable triggers; add external tamper-evident hashes and immutable backups. |

## What is now available for bookkeeping

1. Finance dashboard with CZK/EUR monthly **provider-verified** gross sales, refunds, processing fees, payouts, verified transaction VAT (otherwise explicitly unknown) and per-event breakdown.
2. Owner-entered **unverified expenses**, by event or organization-wide, with date, category (venue, staff, equipment, marketing, travel, services, other), supplier, reference, note and exact minor-unit amount.
3. Correct mistakes only through a dated linked reversal; no edit/delete endpoint. Original and reversal remain visible in the correct reporting periods. A reverse in a later month offsets that later month; an earlier accounting period is not silently rewritten.
4. Separate, MFA-protected CSV exports for verified provider movements and unverified organizer costs. Dangerous spreadsheet cell prefixes remain inert as text.
5. Seller legal data is **self-declared** and invalidates prior payout readiness on change. Document listing contains metadata only; no tax document is fabricated or downloadable.

### Interpretation warning

**Gross sales** is not platform turnover; the organizer is the intended direct seller. **Net after Stripe fees** is not business profit. **Manual expenses** are unverified and must not automatically be deducted from taxable profit or VAT. Any tax figure is absent unless backed by verified data. The platform's own legal-entity bookkeeping requires a **separate scoped book** and counsel/accountant-approved allocations. At launch, TicketTreat's application fee remains zero.

## Mandatory release blockers

- Confirm actual Czech platform entity (colleague's IČO), each seller's ARES/VAT/authority information, appropriate electronic agreement and GDPR/consumer conditions with counsel.
- Implement Stripe Connect direct charges, hosted onboarding, merchant identity verification, raw-body webhook signatures, idempotency, account/amount/currency/event matching, reconciliation and refunds/disputes; protect bank/payout changes through provider confirmation and dual control.
- Prevent paid QR/check-in until the corresponding captured payment is verified; apply an atomic capacity hold and release on failure/timeout. Current legacy paid registration must not be mistaken for payment.
- Implement seller-issued tax documents only after accountant-approved requirements, numbering, signed or tamper-evident private storage, access rights and retention schedules. No fake fiscalized receipts.
- Design an independent TicketTreat **platform accounting** scope; do not reuse an organizer's account ledger or allow global admins to browse other sellers' records.
- Deploy only after independent staging security tests, backup/restore, documented incident recovery and separate owner approval. Do not execute these new migrations on production during review.

## Verification gates

- Local `python -m unittest` pure and security tests, `tsc`, Next.js production build.
- GitHub CI disposable PostgreSQL integration before migrations and security-trigger tests **after** all versioned migrations; verify owner event mismatch, reversal immutability, TOTP replay, bans, revocation, cross-owner denial, export and backup/restore.
- Chromium browser regression including CSRF and sessions. Add a targeted finance UI idle-expiry and expenses smoke test in staging with real MFA before any public release.

## Primary reference material

- [Czech Ministry of Finance ARES IČO guidance](https://www.aresgov.cz/napoveda) — length/control-digit rules do not prove a legal entity exists.
- [Financial Administration: electronic receipts and record retention](https://app.fs.gov.cz/dotazy-verejnosti/dotaz/uctenky-v-elektronicke-podobe-3831).
- [Financial Administration: accounting record retention](https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/ucetnictvi/obecne-informace).
- [Stripe Connect direct charges](https://docs.stripe.com/connect/direct-charges) and [webhook security](https://docs.stripe.com/events/manage-webhook-endpoints).
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
