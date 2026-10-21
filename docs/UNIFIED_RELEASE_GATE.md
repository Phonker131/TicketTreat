# TicketTreat — P0 release audit and deployment gate

**Branch:** `feature/crowdly-release-preparation` → [draft PR #5](https://github.com/Phonker131/TicketTreat/pull/5) → `main`. **NOT released.** The existing Railway production services/database are unchanged.

## P0 requirements — implementation audit, 2026-10-21

| Requirement | Implemented in branch | Still required before public launch |
| --- | --- | --- |
| Unified users and tickets | Verified browser/TG identity linking; free, upcoming legacy bot registrations reconciled into canonical QR tickets; lineage mapping prevents double-capacity counting | Manual reconciliation for paid/old/conflicting bot records; production-data migration trial and organizer checks |
| API, guest and QR security | HttpOnly website sessions, signed Mini App initData, verified principal ticket endpoints without guest tokens in URLs, production anonymous creation disabled; legacy Bot/Backend uses `BOT_API_KEY` | Full external security/abuse test, legacy token rotation, enforced CSP (currently Report-Only), audit CDN/proxy logs |
| PostgreSQL migrations/capacity | Checksum-ledger migration runner with advisory lock, `BIGINT` Telegram IDs, bot unique index, event row locks for registrations/cancellations/waitlist | Backup/restore of **actual isolated production snapshot**, historical duplicate remediation, controlled rollout |
| Registration/QR E2E | Real PostgreSQL integration tests for signup, conversion, MFA, final-seat race, booking, waitlist, promotion, cancellation and check-in | Browser Playwright/live Telegram clients, Resend SMTP/provider and complete Railway staging smoke tests |
| Organizer/admin MFA and audit | Encrypted TOTP setup, per-session elevation, privileged endpoint enforcement, manually approved organizer requests, admin and event/check-in audits | Secure recovery policy, phishing-resistant WebAuthn if required, review existing organizer grants and live role migration |
| Monitoring/backup | Safe request IDs and structured logs, health probes, pg_dump script, checksum, disposable PostgreSQL backup/restore CI | Configure **encrypted offsite storage and recurring schedule**, real restore drill, production healthcheck, tracing/5xx/volume alerting |
| GDPR erasure/retention/docs | JSON export, authenticated request/withdrawal, MFA-admin fulfillment for eligible accounts, irreversible audit, blocker checks; policy and retention drafts | Controller's registered legal details, approved retention durations and processor contracts, fulfillment of complex linked/financial cases, backup expiry and compliance sign-off |

Green source-level CI does **not** establish operational production readiness.

## Deployment configuration

### Service boundaries

- **Legacy Backend**: `APP_ENV=production`, `DEMO_ISOLATED_API=false`, `BOT_API_KEY` (same high-entropy key as Bot).
- **Telegram Bot**: `BOT_TOKEN`, `BOT_API_KEY`, internal `BACKEND_URL`, public HTTPS `WEB_APP_URL`.
- **Web-facing Demo API**: `APP_ENV=production`, `DEMO_ISOLATED_API=true`, `DEMO_PAYMENT_MODE=false`, strong `AUTH_CODE_SECRET`, separate `MFA_ENCRYPTION_KEY`, PostgreSQL URL, verified Resend sender as applicable.
- **Next.js Frontend**: server-only `BACKEND_API_URL`, approved HTTPS domain and trusted API origins.
- **Backup worker/storage**: durable encrypted **offsite** destination, scheduled `pg_dump`, rotation and restore monitoring (not currently configured).

No secrets, backup artifacts, production DB snapshots or QR tokens belong in Git.

### Safe rollout sequence

1. Freeze/test one release SHA; confirm Python, TS/Next and PostgreSQL CI.
2. Provision isolated Railway staging, throwaway Telegram bot and **restored snapshot** of production DB; prevent staging from sending real messages.
3. Check historical `registrations` duplicates and account/email/Telegram conflict counts before unique constraints or conversion; fix by reviewed migration, never silently drop rows.
4. Rehearse `python backend/migrations/apply.py` and rollback, schema compatibility with old Bot and Backend, and manual privacy/MFA flows.
5. Configure app/service keys **before switching the Backend service**. Missing `BOT_API_KEY` must fail closed (otherwise bot commands break). Configure MFA key safely and retain recoverable escrow.
6. Rehearse scheduled encrypted offsite backup restore, audit row counts, permissions and ticket consistency.
7. Confirm web, Mini App and Bot in live clients; email verification/password reset and sender reputation; privileged access; site check-in; event cancellation; GDPR notices.
8. Configure operational monitoring/alerts and switch services incrementally with clear rollback gates.
9. Only then merge PR #5; keep the existing `crowdly-demo-mvp-20261020` Railway source branch until switched and verified.

## Real-money sales

**Disabled.** A licensed PSP, verified webhooks, refunds, organizer onboarding/payouts, commission accounting, registered business and legal documents are separate prerequisites before any paid event sale.

## Detailed references

- [Telegram integration](TELEGRAM_MINIAPP_INTEGRATION.md)
- [Privacy notice — legal draft](PRIVACY_NOTICE_DRAFT.md)
- [Retention matrix — decisions pending](DATA_RETENTION_MATRIX.md)
- [Railway operations and backups](PRODUCTION_OPERATIONS.md)
- [Backend security status](../backend/SECURITY_STATUS.md)
