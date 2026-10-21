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

1. Back up production PostgreSQL; restore a copy to staging and verify row counts, accounts, tickets and migrations.
2. Keep `APP_ENV=production` and `DEMO_PAYMENT_MODE=false`; do **not** enable simulated paid checkout.
3. Configure secrets only on the relevant Railway services. Required email secret: `AUTH_CODE_SECRET` (random 32+ characters); leave email sending disabled until Resend is verified.
4. Deploy the isolated FastAPI web API and Next.js frontend to staging first. Set server-side `BACKEND_API_URL` on Next.js.
5. Run browser/PWA, Telegram Mini App, bot, account, QR and email smoke tests.
6. Back up production again, complete the change window and rollback plan, then deploy the tested build. Only switch the existing Bot after successful API/frontend verification.
7. Do not merge the release PR until technical and operational checks pass.

## Maintenance conventions

- Keep **one active feature/release branch** and one release PR; use descriptive commits for rollback.
- Keep the root README short; put engineering runbooks in `docs/` or `backend/`.
- Do not commit environment secrets, database snapshots, user data, generated code artifacts or local build output.
- Run [CI](../.github/workflows/ci.yml) on each update.

See [Telegram integration](TELEGRAM_MINIAPP_INTEGRATION.md) and [security status](../backend/SECURITY_STATUS.md).
