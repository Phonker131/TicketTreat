# TicketTreat — Railway operations and recovery

This is a **runbook, not evidence of completed production setup**.

## Observed environment — 2026-10-21

Railway project **TicketTreat Production** currently has services **Backend, Bot, Demo API, Frontend, Postgres** marked online. The PostgreSQL service has a persistent volume. Railway service tracing is disabled; no project webhooks were listed. A persistent PostgreSQL volume is **not** an offsite backup. The current production services run older GitHub branches; this release candidate is **not deployed**.

## Required secret and service boundaries

- `Backend` (legacy bot-facing FastAPI): `APP_ENV=production`, `DEMO_ISOLATED_API=false`, `BOT_API_KEY` (32+ random characters).
- `Bot`: the same private `BOT_API_KEY`, plus `BOT_TOKEN` and the private `BACKEND_URL`.
- `Demo API` (public site-facing FastAPI): `APP_ENV=production`, `DEMO_ISOLATED_API=true`, `DEMO_PAYMENT_MODE=false`, `MFA_ENCRYPTION_KEY` (Fernet), `AUTH_CODE_SECRET`, verified email credentials and PostgreSQL URL.
- `Frontend`: `BACKEND_API_URL` as a **server-only** internal URL and the public HTTPS origin. Never place backend secrets in `NEXT_PUBLIC_*`.
- Test separately before switching any Railway service's GitHub branch; switching `Backend` without provisioning its shared bot key would block the legacy bot.

## Database changes and backup

1. Make a consistent snapshot of **production data** before migration; do not use the live database for development/testing.
2. Restore it into an isolated staging database and inspect duplicate legacy registrations:
   `SELECT user_id,event_id,COUNT(*) FROM registrations GROUP BY user_id,event_id HAVING COUNT(*)>1;`
3. Ensure all required migrations are reviewed and `python backend/migrations/apply.py` runs successfully in staging. A unique index deliberately rejects duplicate registrations; resolve conflicts before production.
4. Set a private, **durable encrypted offsite backup** destination and schedule a separate backup job. The repository provides `python scripts/backup_postgres.py --output-dir /absolute/secure/path`. This creates a private **unencrypted** PostgreSQL dump; the destination or transfer MUST provide encryption and restricted access.
5. Rehearse restoration using `pg_restore` into an isolated database; compare row counts, tickets and permissions. CI already rehearses backup/restore using **disposable PostgreSQL**, not Railway data.
6. Record recovery point/time objectives, backup rotation policy, owner, verification cadence and emergency access. None are inferred from a working database service.

## Monitoring and alerting

- API endpoints: `GET /demo/health/live` and `GET /demo/health/ready` (includes SQL connectivity).
- New Python request logs provide a request ID, route template, status and elapsed time without logging raw guest/QR URLs or request bodies.
- Deploy Uvicorn with `--no-access-log` on public API services until upstream access logs are configured to scrub token-bearing paths.
- Establish Railway health checks, tracing after privacy review, 5xx/latency alert thresholds, storage alerts and a trusted notification destination. Current tracing/webhooks were observed disabled/unconfigured.
- Keep dashboards/alerts restricted to operators. Do not send user emails, tokens or QR values to the alert sink.

## Release acceptance

- Separate staging environment with private DB and throwaway bot;
- CI all green on exact release commit;
- Backup/restore of realistic staging copy and documented rollback;
- Browser, Telegram Mini App and bot login tested;
- Free booking, capacity racing, cancellation, waitlist, QR check-in and administrator MFA tested;
- Email verification/reset/delivery, error monitoring and retention verified;
- No paid-event purchase flows enabled without real regulated payment integration and the registered business.

## Rollback

Keep prior Git commit/deployment and verified backup. Reverse **application code** independently where possible; never blindly roll back irreversible database migrations. Document compensating SQL and reconciliation before attempting a schema rollback.
