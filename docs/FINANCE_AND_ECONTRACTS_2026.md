# TicketTreat — organizer finance & electronic agreements

**Status: technical foundation, NOT live payment, tax accounting or legally approved contracts.** Reviewed by platform owners only after lawyer and Czech accountant approval. Stripe account and real payments have not been touched.

## Commercial setup

- TicketTreat will operate under the Czech IČO of the platform operator (actual identity to be verified). Each organizer is the direct seller of its tickets and receives sales proceeds on its own connected Stripe account; TicketTreat initially charges **0%** platform commission. Processing fees payable to Stripe are separate.
- Intended Stripe Connect model: **direct charges** to verified connected accounts, zero application fee, with independently validated connected-account ownership and settlement settings. No shared intermediary TicketTreat bank account should be represented as the seller's account.
- Before live launch determine actual intermediary, consumer, data protection and tax responsibilities with Czech professional advisers.

## Implemented guardrails (backend + UI on review branch)

1. Isolated seller records, append-only ledger, document metadata, immutable contract versions and per-organization agreement records.
2. Finance read access only for a verified organization owner or global admin, not an invited team member or guests. Authentication enforces existing bans and privileged MFA.
3. Owner may declare legal name, Czech IČO, DIČ and VAT status. Czech IČO is checked for its offline control digit, but its existence and signatory authority remain **unverified** until registry/KYC checks. Editing seller identity **invalidates verified status and disables charges/payouts**. No self-verification API exists.
4. Provider events have unique source keys to prevent double-recording. PostgreSQL triggers block changes/deletion to the financial ledger or accepted contracts. Corrections must be new records.
5. Prague-local monthly CZK/EUR financial reporting distinguishes gross sales, refunds, processing fees, payouts and VAT **only when verifiably known**, with per-event breakdown. Monthly *net after processing* is not profit or income-tax liability. A zero tax field is never silently substituted for unknown tax.
6. CSV export is spreadsheet-formula hardened. Private document storage keys/content never appear in the listing. The initial UI has no fake invoices, tax documents or fiscalized receipts.
7. No agreement is pre-published. Only an approved published version with an unchanged SHA-256 digest may be accepted by a verified owner with MFA. Such online acknowledgement is not represented as a qualified eIDAS electronic signature.
8. A separate manual organizer **expense journal** records date, category, supplier, reference, event and CZK/EUR amount. It is clearly **self-reported**, never counted as provider revenue or certified tax deduction. Each entry and its correction are append-only; reversing a cost creates an exact negative linked entry, with a reason and fresh MFA. CSV export requires an additional unused code and neutralizes spreadsheet formula payloads. No receipt image or document is issued by this feature.
9. PostgreSQL validates event-to-owner association for future inserted provider ledger entries and manual expenses; finance UI now clears cached information on expiry of the 15-minute unlock.

### Financial security hardening

- Access to financial records now needs a separate 15-minute, web-session-bound MFA unlock, even if the general `APP_ENV` is misconfigured. Export, legal identity update and contract acceptance each require a **new single-use OTP**; 2FA code replay is rejected and feature-specific rate limits apply.
- Every successful finance read/export/write is recorded as immutable evidence (actor, target organizer, operation, request ID, optionally a **keyed** fingerprint of a trusted client IP). Tokens, OTPs, raw IPs and customer emails are not stored in that log. Unauthorized finance access and invalid finance OTP generate private admin security alerts.
- All finance responses request `Cache-Control: private, no-store`, and raw client-provided spreadsheet labels are treated as text. No public API can alter Stripe bank payout recipients or mint paid tickets.
- Threat model, test and additional pre-Stripe hardening requirements: [FINANCE_SECURITY_THREAT_MODEL_2026.md](FINANCE_SECURITY_THREAT_MODEL_2026.md).
- Scope, audit outcomes and remaining controls: [FINANCE_SECURITY_AND_ACCOUNTING_AUDIT_2026.md](FINANCE_SECURITY_AND_ACCOUNTING_AUDIT_2026.md).

## Payment rollout requirements — not implemented yet

1. Verify seller IČO in ARES, VAT status with appropriate registers and authority of legal signer. Validate Stripe Connect KYC and account capabilities and maintain a privileged verification log.
2. For each paid ticket: transactional capacity hold; server-authorized connected-account Checkout; idempotent payment creation; signed Stripe webhook validation (account, intent, amount, currency, event, owner); deduplicated ledger posting; independent provider reconciliation; only then mark QR valid for entry. Existing offline paid-registration paths can create QR with payment status not collected — **fix the QR/check-in prerequisite before enabling live payments**.
3. Handle full/partial refund, chargeback, disputes, payouts, failed transfers, FX and Stripe fees separately. Keep exact provider references and audit of correcting entries.
4. Seller-issued payment receipts, legally valid VAT invoices (where required), corrective tax documents and payout statements require verified issuer identity, compliant numbering, private encrypted storage, download permissions, backup/restore, legal retention schedule, and proper accountant validation. Do not treat a Stripe receipt as automatically a VAT invoice.
5. Exportable records can assist an accountant but cannot fully calculate corporate/personal income tax or organization profit without all outside expenses and legal circumstances (OSVČ versus s.r.o., VAT status, etc.).
6. A distinct **TicketTreat platform legal entity accounting book** still needs its own verified legal identity and scoped authorization; organizer expense entries must never be treated as the platform's own costs. No platform commission or platform VAT is inferred from organizer ticket sales.

## EET 2.0, electronic documents, retention

- Czech law **180/2026 Sb.**, applicable from **1 January 2027**, focuses on qualifying *contact payments*. An ordinary remote Stripe Checkout payment with no face-to-face transaction generally does **not** require sending a receipt to EET. Onsite cash or terminal transactions need a separate classification and possibly EET integration. Never issue fake “fiscalized” documents.
- Electronic acceptance after MFA can provide evidence of assent, but is not automatically a qualified electronic signature. For documents legally requiring greater assurance, evaluate BankID/signing provider or qualified signatures under eIDAS.
- Czech VAT documents normally require **10 years** of retention, while some Czech accounting documentation requires **5 years** or other periods, with applicable litigation/AML holds. Privacy data should be minimized and a class-specific retention and data export/deletion schedule adopted.
- Identify each party's GDPR controller/processor role. Conclude an Article 28 data processing agreement wherever TicketTreat acts as processor for the organizer.

Primary references: [law 180/2026 Sb.](https://www.zakonyprolidi.cz/cs/2026-180), [Czech EET guidance](https://www.eet.gov.cz/), [Czech Financial Administration](https://financnisprava.gov.cz/), [eIDAS regulation](https://eur-lex.europa.eu/eli/reg/2014/910/oj), [Stripe Connect direct charges](https://docs.stripe.com/connect/direct-charges).

## Production gates

- [ ] Owner **@Phonker131** reviews protected code files, database migration and cross-tenant security tests via PR. No direct production deployment before review.
- [ ] Test migration constraints and backups on disposable staging PostgreSQL, no production migration until reviewed.
- [ ] Finish database integration tests for owner-only financial access, team members, banned sessions and MFA; test service backup/recovery and secure report export.
- [ ] Czech lawyer approves actual platform and seller identity, the draft Czech agreement, privacy/DPA, refund/consumer conditions, electronic signing procedure.
- [ ] Czech accountant approves seller-of-record status, VAT/DPH classification per event, taxes, invoices, and retention.
- [ ] Complete Stripe Connect onboarding, signed webhooks, payouts/refunds, reconciliation, secure archive, tax-document issuance and onsite EET only where applicable.
- [ ] Verify paid QR issuance/check-in never bypasses verified collection, and add operational alerts, audit trail, retries and financial incident response.

**Expected current state:** financial summary shows no verified payments and electronic contracts cannot be signed until a legally reviewed version has been published. This is intentional.
