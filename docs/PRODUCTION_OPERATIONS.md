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


## Encrypted offsite backups — deploy checklist (implementation added)

The repository now has `scripts/offsite_backup.py` and `scripts/restore_offsite_backup.py`. These use streaming AES-256-GCM to protect a database dump before upload to S3-compatible private object storage; server-side S3 AES-256 encryption and an uploaded SHA-256 metadata check provide extra controls. **As of 2026-10-23 a private EU-region encrypted backup cron worker is active.** The first production archive was uploaded and downloaded again for decryption and PostgreSQL archive-format verification. A full restore into an isolated database is still pending.

Provision a dedicated PRIVATE backup worker with no public domain, no reuse of bot credentials and a dedicated read-only PostgreSQL backup user. Install `boto3`, `cryptography` and PostgreSQL client binaries matching the database major version. Set these as private worker secrets: `DATABASE_URL`, `TT_BACKUP_KEY_HEX` (a randomly generated 64-character hex value stored separately from the backups), `S3_BACKUP_BUCKET`, `S3_BACKUP_PREFIX`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` and optionally `S3_ENDPOINT_URL`.

The cron/start command after secrets and encrypted object storage are configured is:

```sh
python scripts/offsite_backup.py --scratch-dir /tmp/tickettreat-private-backup
```

Choose cron cadence according to the approved RPO, verify error notifications and configure S3 object lifecycle expiration, versioning and privileged delete protections. The private scratch location briefly contains unencrypted dump material; it is wiped by the utility on ordinary exit but cannot be assumed safe on a crashed/compromised worker. Keep it isolated; do not use shared mounts.

**Restore rehearsal into a new, isolated staging DB only:**

```sh
python scripts/restore_offsite_backup.py \
  --s3-key 'tickettreat/database/YYYY/MM/DD/<known-object-key>.dump.ttbk' \
  --destination /private/restore/tickettreat-staging.dump
# Verify the destination is NOT the live production DB before pg_restore:
pg_restore --no-owner --no-acl --dbname 'postgresql://STAGING_HOST/STAGING_DB' \
  /private/restore/tickettreat-staging.dump
```

Review row counts, linked ticket claims, old bot identities, role grants and migration-ledger state. Destroy the temporary plaintext file securely, record the successful restoration and test rollback. The S3 permissions, key escrow, backup object lifecycle, retention periods and provider/data-processing approvals are operator decisions.


## Backup rollout verified 2026-10-23

- Private Railway service: Encrypted DB Backups (ID 44e8896d-db50-4e45-be8b-9f19a2f72b1a). No public domain. Uses PostgreSQL 18 client, encrypted backup scripts, CPU cap 0.5 vCPU and RAM cap 0.5 GB.
- Private Railway bucket: tickettreat-db-backups (ID 3153b0e1-95c3-469a-89b5-728aec6e169a) in Amsterdam (AMS). This is a separate storage resource but still in the same Railway project/account; not independent-provider disaster recovery.
- Schedule: 0 3,15 * * * (03:00 and 15:00 UTC). After each successful upload the worker downloads the exact object, verifies SHA-256 checksum, decrypts AES-256-GCM and checks the PostgreSQL archive with pg_restore --list.
- First real verified object: tickettreat/database/2026/10/23/tickettreat-20261023T211453Z-291036.dump.ttbk. The plaintext pg_dump size was approximately 8.9 MB; only the AES-GCM encrypted archive was uploaded.
- Backup database URL: a Railway private-network variable reference to Postgres.DATABASE_URL; bucket keys are references, and TT_BACKUP_KEY_HEX is stored only on the worker. Keep a separate protected offline/key-manager copy: losing this key makes backups unrecoverable.
- Public PostgreSQL TCP proxy nozomi.proxy.rlwy.net:21803 was deleted; subsequent Railway proxy inventory returned no public TCP proxies. Public Internet psql connections relying on that hostname will no longer work. Existing Railway application services remained online.
- **Verified on 2026-10-24:** Restored the real 03:00 UTC production backup into an ephemeral, isolated PostgreSQL 18 cluster using a private Unix socket; verified critical tables and migration ledger. The temporary Railway restore service was deleted immediately afterward (no persistent volume). This is a real archive restore drill, not just `pg_restore --list`. See below.
- **Still outstanding:** secure an independent backup encryption-key escrow, confirm alerting on cron failures, adopt documented object-expiration/retention rules, and maintain a separate-provider/account DR copy. Never run pg_restore against live production.


### Real encrypted production backup restore drill — 2026-10-24

- Source archive: `tickettreat/database/2026/10/24/tickettreat-20261024T030004Z-cd2900.dump.ttbk` in the private Amsterdam bucket.
- Disposable Railway `Temporary DB Restore Drill` ran `scripts/staging_restore_drill.py` using PostgreSQL 18, without `DATABASE_URL`, a public domain, a network listener, or attached volumes.
- Remote object downloaded, AES-256-GCM authenticated/decrypted, restored with `pg_restore --exit-on-error --no-owner --no-acl`, and queried with `psql` over a local-only Unix socket. Key table counts were read and verified; no PII was logged.
- Runtime log: `Isolated PostgreSQL 18 restore verified`; Railway reported `SUCCESS`. The temporary service was then deleted.
- This validates the **current backup's restorable format and records**, but is not a guarantee of zero data loss or independent-provider resilience. Keep the key escrow, DR access, alerting and retention work items open.
