# TicketTreat — release readiness

**Active release branch:** `feature/crowdly-release-preparation`  
**Target:** `main` through [PR #5](https://github.com/Phonker131/TicketTreat/pull/5) after review.  
**Deployment state:** release not published; existing Railway services and production PostgreSQL untouched.

## What is currently implemented

| Area | Current source |
| --- | --- |
| Website / Telegram Mini App | Single responsive Next.js frontend; Telegram signed launch |
| Backend / storage | FastAPI, PostgreSQL, SQLAlchemy; legacy bot retained |
| Users | Email registration/verification, Argon2id, password recovery, sessions |
| Identity | Explicit email + Telegram linking with duplicate-registration conflict handling |
| Events | Organizer CRUD, geo-discovery, media links, homepage editor |
| Entry | Free QR tickets, waitlist, cancellation, scanning/check-in |
| Notifications | Telegram confirmations; optional Resend transactional outbox and reminders |
| Data rights | Authenticated profile/ticket JSON export |
| CI | Python, Next.js/TypeScript, PostgreSQL 16 integration and additive SQL smoke test |

These are *implemented code paths*, not proof of production end-to-end functionality.

## Release blockers

- [ ] Complete authorization audit of anonymous guest tokens, public ticket URLs, CSV exports, old Bot/Backend endpoints and roles.
- [ ] Complete HTTPS cookie/CSRF/CSP/XSS hardening and administrator MFA before privileged production use.
- [ ] Finalize personal data deletion, retention and recovery processes and privacy notice.
- [ ] Verify staging DB snapshot restore and the additive SQL migration without data loss; do not rely on `create_all` to modify existing columns.
- [ ] Configure domain, DNS, HTTPS, `BACKEND_API_URL`, trusted CORS origins, separate Bot and API secrets.
- [ ] Verify Resend, sender DNS, email verification/reset/delivery and 24h reminders using real staging accounts.
- [ ] Test Telegram Mini App signed login, identity linking, legacy Bot commands, event deep links and QR scanning on actual clients.
- [ ] Test free checkout, attendee capacity, waitlist, duplicate prevention, cancellation and role boundaries on a staging database.
- [ ] Add a licensed payment processor, server-verified webhooks, organizer settlement, refunds and chargeback logic **before enabling paid events**.
- [ ] Set up monitoring, backup/restore drills, incident handling and rollback.

## Railway release process

1. **Source branch safety:** Railway Production currently follows `crowdly-demo-mvp-20261020` for Frontend, Bot and Demo API, and `main` for Backend. Keep the old branch intact until each service has been successfully retargeted. Closing PR #2 does not change Railway source settings.
2. Back up production PostgreSQL; restore a copy to staging and verify row counts, accounts, tickets and migrations.
3. Keep `APP_ENV=production` and `DEMO_PAYMENT_MODE=false`; do **not** enable simulated paid checkout.
4. Configure secrets only on the relevant Railway services. Required email secret: `AUTH_CODE_SECRET` (random 32+ characters); leave email sending disabled until Resend is verified.
5. Deploy the isolated FastAPI web API and Next.js frontend to staging first. Set server-side `BACKEND_API_URL` on Next.js.
6. Run browser/PWA, Telegram Mini App, bot, account, QR and email smoke tests.
7. Back up production again, complete the change window and rollback plan, then deploy the tested build. Only switch the existing Bot after successful API/frontend verification.
8. Do not merge the release PR until technical and operational checks pass.

## Maintenance conventions

- Keep **one active feature/release branch** and one release PR; use descriptive commits for rollback.
- Keep the root README short; put engineering runbooks in `docs/` or `backend/`.
- Do not commit environment secrets, database snapshots, user data, generated code artifacts or local build output.
- Run [CI](../.github/workflows/ci.yml) on each update.

See [Telegram integration](TELEGRAM_MINIAPP_INTEGRATION.md) and [security status](../backend/SECURITY_STATUS.md).


## Hardening changes in the current branch

The following controls are implemented but require staged release validation:

- Production guest ticket endpoints accept the exact verified website-account session or freshly signed Telegram `initData` for the owning guest; possession of an old `guest_token` by itself is not sufficient.
- Anonymous demo guest creation and shared-key administrative endpoints are disabled when `APP_ENV=production`. Use verified account login and ownership-scoped `/demo/manage/*` routes.
- Capacity-changing event registration, cancellation and waitlist actions serialize on the same PostgreSQL event row. A final-seat concurrency integration test is included.
- Account holders can export their data and file/withdraw an erasure request with password confirmation in `/privacy`. Actual erasure is **not automatically performed**: fulfillment requires policy/legal retention review and a controlled administrative process.
- Admin role grants and recovery are recorded in `demo_account_admin_audit`. This is not a substitute for MFA.
- `/demo/health/live` and `/demo/health/ready` offer process liveness and PostgreSQL-backed readiness without exposing credentials.
- Use `python backend/migrations/apply.py` from the repository root to apply checked-in SQL migrations. The runner takes an advisory PostgreSQL lock, runs migrations transactionally, tracks filename + SHA-256 digest, skips already applied files and refuses changed applied migrations. A database backup and restore test is mandatory before production; the old `create_all` path alone is not a migration.

### Security-critical environment

The production API should set `APP_ENV=production`, `DEMO_ISOLATED_API=true`, `DEMO_PAYMENT_MODE=false`, and use trusted `FRONTEND_ORIGINS`. The Next.js frontend needs `BACKEND_API_URL` pointing to the trusted internal API. Account email verification requires `AUTH_CODE_SECRET` and a verified transactional email provider. Do not expose tokens in `NEXT_PUBLIC_*` variables.

### Remaining launch blockers

**Still not complete:** full legacy Telegram registration migration to a unified canonical ticket model; privileged phishing-resistant MFA; formal personal-data erasure fulfillment, privacy notices and retention schedule; production CSP/XSS and penetration review; tested Railway staging DB restoration and rollback; operational mail bounce handling, monitoring/alerting and incident response. Real-money payments, commissions, marketplace payouts, settlement and refund workflows require a contracted payment provider and business/legal setup. Do not activate paid sales.
