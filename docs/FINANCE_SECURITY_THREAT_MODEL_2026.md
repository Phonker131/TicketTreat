# TicketTreat finance security: threat model and launch gate

**Status: draft PR only. No live payment, payouts, production database migration or Stripe onboarding.** Owner @Phonker131 must review protected auth/API files and independent PostgreSQL security tests before staging and any live release.

## Threats from the November incident and beyond

| Threat | Layered defense in this branch | Remaining payment-launch requirement |
| --- | --- | --- |
| Disposable/impersonation account registering as organizer | Existing anti-disposable signup controls; finance only for server-verified organizer owner/global admin, with MFA and a 15-minute second unlock | Verify real seller (ARES, VAT register, legal authority and Stripe KYC) before charges are enabled |
| Banned account still has a session, MFA elevation or old unlock | Finance access rechecks canonical web session and permanent ban on **every** call; finance grant is bound to the web session hash | CI tests against revoked sessions and persistent bans; periodically purge expired finance grants |
| Accepted team member attempts to access finance or uses guessed owner ID | Role-based and object-level checks on every endpoint; team membership never grants finance read, export or legal signing | Review cross-organization owner reassignment and connected-account ownership at every payment operation |
| Session theft or short-term browser compromise | Normal organizer MFA **plus** a separate fresh one-time code for a 15-minute finance unlock; no bearer token in response or audit | Rate-limit theft attempts at gateway, device/session anomaly monitoring, login alerts, shorter session lifetime as appropriate |
| Export, identity change, or agreement acceptance during an unlocked session | **Another fresh single-use TOTP**; invalid/replayed TOTP rejected, account-level rate limits, no cross-origin browser post | For future bank/payout changes require explicit dual approval and beneficiary confirmation through the payment provider |
| IDOR, role escalation, automated API enumeration | Server-side authorization, request quota, per-actor alert on a verified unauthorized finance access; all finance endpoints no-store/noindex | Run security CI and staged penetration tests; validate admin delegation and privilege changes |
| Sensitive financial data in logs or spreadsheets | Audit records actor/owner/action/request ID and keyed HMAC of authenticated gateway/peer IP (never raw IP, email, OTP, token); CSV text is safely prefixed to prevent formula execution | Restricted log access/retention, alert review, managed encrypted storage and downloadable audit for owners |
| Forged or repeated financial event / false payment proof | Append-only ledger, provider-source uniqueness, separate currencies, no public payment/ledger mutation endpoint; legacy registrations never equated with sales | Signed Stripe connected-account webhooks, exact owner/event/amount/currency match, idempotency, out-of-order event reconciliation, refund/dispute handling |
| Attacker redirects money to their account | Organizers cannot self-assign connected Stripe IDs, cannot mark seller KYC as verified or turn on charges/payouts; profile change always disables payment readiness | Stripe hosted Connect onboarding; prohibit arbitrary payout edits; independent verification and dual control for bank-account changes; alert beneficiary modifications |
| Tampered/fake tax document or contract | No public document issuance/download; metadata only; immutable archived document and agreement-acceptance records, approved contract hash matching | Signed issuer documents, checksum-verified encrypted files, private storage, WORM/backup, legally approved format and retention |
| Administrator privilege abuse / compromised global admin | Global admins still require finance MFA and fresh OTP; **cross-organization finance reads are denied even to global admins**. Every allowed financial access is logged with actor and target owner | If support access is ever needed, build explicit seller consent, narrow scope, documented purpose, dual approval, expiry and break-glass audit. Two-person approval for bank/payout or seller reassignment |

## What cannot be guaranteed by code alone

- A compromised PostgreSQL superuser, deployment credential, owner 2FA device, Stripe administrator, connected-account owner or private document bucket can still be dangerous. Secrets must live only in Railway/Stripe secret stores, rotate on compromise, and be reviewed with least privilege.
- The finance dashboard contains **no real card data** and intentionally performs **no payments** yet. PCI scope should be minimized by redirecting to Stripe-hosted checkout, not collecting PAN/CVC on TicketTreat.
- Browser-side permission checks are UX only; all enforcement is on the backend. CORS/CSRF origin checks exist in the Next.js gateway. Do not add browser tokens to URLs, logs, localStorage or Stripe metadata.
- Append-only DB triggers preserve normal app writes, but database owners and superusers may bypass or remove triggers. True tamper evidence requires external periodic hashes, immutable/WORM backups, least-privilege production database roles and access monitoring.
- A 15-minute unlock reduces exposure but does not protect a device compromised **during** the unlocked window. Sensitive operations therefore need another fresh single-use code, and future money movement needs dual control.
- Legal archival and privacy requirements may conflict with retaining everything forever. Use case-specific retention, controlled export and lawful deletion/hold rules with Czech counsel.

## Tests and rollout

- Pure unit tests cover VAT-unknown policy, ledger amounts, date boundaries, mass assignment rejection, CSV injection and keyed IP fingerprints.
- PostgreSQL CI scenarios cover denied team/other-organizer finance access, 2FA unlock, OTP replay, forged Stripe fields, contract acceptance and override of an existing unlock by permanent ban/session revocation. Run only on a disposable database named `tickettreat_ci`; never run destructive auth tests on production.
- Test normal authorized organizer flows with a real test authenticator and existing MFA enrollment as well as the adversarial cases. Include rate limit, expired unlock, admin scoped audit, and contract hash mismatch in staging.
- Before enabling Stripe: verify webhooks using Stripe's raw request body and secret, match `event.account` / connected account, use idempotent payment state transitions, guard check-in after verified paid state, and test refunds, disputes, duplicate events, cross-owner mixups, chargeback and worker retry.
- Enforce a freeze gate: signed-off legal terms, accountant's tax rules, Stripe KYC, independent security review, CI, staging restore test and **separate owner decision to deploy**.

References: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html), [Stripe Webhook Signatures](https://docs.stripe.com/webhooks/signature).
