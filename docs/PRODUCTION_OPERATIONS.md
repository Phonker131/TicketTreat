# TicketTreat — production Railway operations and disaster recovery

**Verified: 24 October 2026.** This runbook describes an operating production system, not a future-only release plan. Keep all credential values and backup plaintext out of GitHub, email, chat and logs.

## Service inventory

| Service (Railway display label) | Role | URL / notes |
| --- | --- | --- |
| Frontend | Next.js website and Telegram Mini App | `https://tickettreat.eu` |
| TicketTreat API (`Demo API` is its **old Railway label**) | Primary public API, site/user-facing | `/api/v1/*`; legacy `/demo/*` preserved |
| Backend | Separate legacy Bot API, private server-to-server auth | Never treat as browser public API |
| Bot | Telegram commands and updates | Secret-validated HTTPS webhook at `/telegram/update` |
| Postgres | Production data | Private DNS, **no public TCP proxies** |
| Encrypted DB Backups | Twice-daily encrypted backup to private AMS bucket | Cron `0 3,15 * * *` UTC |
| Pilot Health Monitor | Checks website, primary API and legacy Backend | Cron `*/15 * * * *` UTC |
| Production Incident Alerts | Sends Railway incident alerts to admin Telegram chats | Secret-gated callback, no guest PII |

Application services, backup/alert functions and the database were observed Online, and the latest deployment was successful. Resource-usage dashboards and alert receivers do **not** establish that a real customer's full booking flow has been tested.

## API migration and safety boundaries

- **Canonical API namespace:** `GET /api/v1/health/live`, `GET /api/v1/health/ready`, `/api/v1/auth/*`, `/api/v1/me/*`, `/api/v1/manage/*`, `/api/v1/events/*`. The BFF route is `/api/gateway/api/v1/*`.
- **Backward-compatible namespace:** `/demo/*` remains available, including previously generated QR and media URLs. Use versioned URLs for new integrations. Removing the legacy prefix would break existing tickets and clients.
- Both namespaces use the **same** role checks, MFA guards, HMAC Telegram launch verification, capacity/QR locks, GDPR controls, and request no-store headers. `/demo/admin/*` remains disabled in production even via `/api/v1/admin/*`.
- Production API still uses internal configuration flag `DEMO_ISOLATED_API=true`; changing its name requires a separate rollout. This flag distinguishes the website API from the isolated Bot Backend; it is not proof that the live service is a mock.
- Legacy Bot Backend runs with `APP_ENV=production`, `DEMO_ISOLATED_API=false`, matching private `BOT_API_KEY` on Backend and Bot. Do not expose its shared key to the public browser.
- Bot delivery is `BOT_DELIVERY_MODE=webhook`, with private `BOT_WEBHOOK_SECRET` and HTTPS `BOT_WEBHOOK_URL`. The bot registered its webhook on startup after resolving long-polling 409 errors.

## Availability & alerts

- Primary API readiness: `/api/v1/health/ready` (includes a database `SELECT 1`). Legacy public path `/demo/health/ready` is still valid.
- **Legacy Backend** deliberately rejects public `/demo/*` routes in production; use its allowlisted `GET /` healthcheck instead. Do not configure `/demo/health/ready` there; it causes false 404 alerts.
- `Pilot Health Monitor` probes production every 15 minutes; Railway incident webhook notifies the admins of `Deployment.failed`, `Deployment.crashed`, `Deployment.oom_killed`, `VolumeAlert.triggered` and `Monitor.triggered`.
- **Known test alert**: `2026-10-24T10:18:33.942Z Deployment.failed Railway service` was created by the Railway webhook test operation, with a generic service name. It was **not a confirmed production outage**. Later, a test monitor briefly crashed on the blocked legacy route; the probe was corrected, and the monitor next showed `cronSucceeded`.
- Never log user emails, signed Telegram initData, request body/PII, QR bearer strings, backup keys or bot tokens. Keep incident receiver destinations private and authenticated.

## Encrypted backup & restore

**Live, verified setup:**

- Worker `Encrypted DB Backups`, CPU 0.5 vCPU, RAM 0.5 GB, PostgreSQL 18 client, private-only; scheduled twice daily at **03:00 and 15:00 UTC**.
- Private AMS bucket `tickettreat-db-backups` holds AES-256-GCM encrypted `.dump.ttbk` archives. Railway variable references supply bucket credentials and a private Postgres URL; `TT_BACKUP_KEY_HEX` exists only as a secret in the worker.
- Each backup runs `pg_dump`, encrypts *before* uploading, re-downloads the object, verifies SHA-256, decrypts, and checks PostgreSQL archive structure via `pg_restore --list`.
- **Full restore proven on 24 October 2026:** a real 03:00 production archive was downloaded/decrypted and restored into an **ephemeral isolated PostgreSQL 18 cluster** over a Unix socket. The drill queried counts from `users`, `registrations`, `demo_tickets`, `demo_web_accounts`, `demo_privacy_requests` and the migration ledger. The one-shot Railway restore worker was deleted afterward, without a persistent volume.
- Public PostgreSQL proxy `nozomi.proxy.rlwy.net:21803` was deleted. Postgres must remain reachable only inside Railway private networking; reconnecting a laptop directly by the retired hostname is not supported.

**Outstanding**: externally escrow the AES encryption key in an access-controlled password manager or HSM, define backup-object retention and scheduled-failure alerts, maintain a second independent-provider/account DR copy, and routinely rehearse restore. Same-project backups do not protect against compromise of the entire Railway workspace.

Never use production `DATABASE_URL` in a restore drill. `scripts/staging_restore_drill.py` explicitly refuses it and spins up a private disposable PostgreSQL instance. Do **not** run `pg_restore` against production. For code and tests, see `ops/backup/restore.Dockerfile`, `scripts/offsite_backup.py`, `scripts/restore_offsite_backup.py` and `backend/src/tests/test_staging_restore_drill.py`.

## Release workflow

1. Prepare reviewable change on a feature branch; run Python unit/integration, Chromium E2E, production frontend build and vulnerability audits. Record exact commit SHA.
2. For data/schema changes, test migrations on an isolated database. Never apply irreversible schema changes just to rename a brand or API path.
3. Store approved changes on canonical `release/tickettreat-production`; point the website, API, bot, legacy Backend and backup worker to that exact branch. Wait for actual deployment success.
4. Check Railway readiness, HTTPS response codes, bot webhook startup, email/Telegram queues, pending offers/expiries and scanner success with test accounts.
5. For outages, roll back **application code** independently and consult the proven encrypted backup. Do not blindly restore an old database or lose new registrations. Stop paid-event registration if data consistency is uncertain.

## Remaining pre-pilot conditions

Real-phone login/check-in and Telegram-message smoke tests; an attendee rehearsal with 10–20 volunteers; isolated full-time staging and separate test bot; approved operator/retention documentation; backup-key custody outside Railway; staff fallback process. **TicketTreat does not currently process payments.** See [engineering status](FREE_PILOT_ENGINEERING_STATUS.md) and [release checklist](UNIFIED_RELEASE_GATE.md).
