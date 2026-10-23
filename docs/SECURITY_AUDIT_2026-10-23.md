# TicketTreat — pre-pilot security audit (2026-10-23)

Scope: code on production release branch `feature/crowdly-release-preparation`,
Railway "TicketTreat Production" (Frontend, Demo API, Backend, Bot, PostgreSQL),
and existing runbooks. This is a targeted source/config audit plus automated
regression checks, **not** a penetration test or legal certification.

## Findings and remediations

| Priority | Finding | Evidence | Disposition |
| --- | --- | --- | --- |
| HIGH | Website profile serialized `demo_guests.access_token` to authenticated browser/Google sessions. This is a second, unnecessary bearer credential. | `demo_accounts.profile_dict` | **Fixed**: return empty token in production as already done for signed Telegram principal responses. Session cookie is still HttpOnly; no forced logout. |
| CRITICAL | Security dependency audit flagged Next.js 15.5.9 and its image/CSS dependencies, including DoS and other advisories. | GitHub Actions npm audit (critical/high) | **Patched on this branch**: Next.js 15.5.28 and PostCSS override >=8.5.23; await clean audit and build before release. |
| HIGH | Python dependency audit found 25 advisory records in anyio, idna, Mako, python-dotenv, Starlette and cryptography. | GitHub Actions pip-audit | **Patched on this branch**: advisory-fixed Python dependency versions; audited successfully on CI. |
| HIGH | Production PostgreSQL formerly had a public Railway TCP proxy. | Railway inventory 2026-10-23 | **Closed**: proxy removed; follow-up proxy listing empty and all Railway application services Online. External psql access via the retired endpoint no longer works. |
| HIGH | Persistent volume alone was not a backup; previously no verified encrypted archive. | Railway production backup logs 2026-10-23 | **Partially remediated**: private EU bucket plus twice-daily encrypted backup job, first archive verified after full download/decrypt/pg_restore archive-list test. Independent staging restore, alerts, retention and off-provider replication are still outstanding. |
| MEDIUM | Unknown accounts could be rejected before Argon2id password verification, exposing account existence through response-time differences. | `demo_accounts.login` | **Fixed**: verify a per-process dummy Argon2id hash for absent accounts. Existing IP/email rate limits retained. |
| MEDIUM | Trusted-admin QR handler and organizer wrapper did not lock ticket rows before checking/marking attendance. Simultaneous scans could duplicate effects. | `main.demo_admin_check_in`, `demo_roles._secure_checkin` | **Fixed**: PostgreSQL `SELECT ... FOR UPDATE` in both. Existing idempotency and audit behavior preserved. |
| MEDIUM | Erased website accounts could retain previously issued unclaimed Telegram browser-link challenges until TTL expiration. | `demo_privacy.fulfill` | **Fixed**: revoke pending link challenges transactionally during eligible erasure. |
| MEDIUM | Dependencies may go stale without continuous advisory checks; no Dependabot config. | GitHub repo workflows | **Fixed**: add weekly Dependabot PRs for npm/pip/Actions and scheduled + PR dependency audits. |
| MEDIUM | Telegram bot polling raises `409 getUpdates conflict` at runtime. This can be a second active poller or token reuse (not proof of compromise). | Recent Railway Bot runtime logs | **Operator action required**: stop external/duplicate poller; inventory token holders and rotate the token if you cannot account for every poller, updating Bot and Demo API atomically. Test Telegram login and reminders after rotation. |
| MEDIUM | Data-retention periods for free events, email outbox, and backups have not been legally approved; `PRIVACY_FREE_TICKET_RETENTION_DAYS` not configured. | `docs/DATA_RETENTION_MATRIX.md`, deployed variable name inventory | **Operator/legal action required**: determine Czech/EU retention periods, update privacy notice, configure retention and data-subject-response process. Do not assume arbitrary numbers. |
| LOW | Some Next.js sensitive shell routes weren't in the explicit no-store rules. API requests were already private/no-store. | `frontend/next.config.mjs` | **Fixed**: extend no-store policy to the loyalty and account-security/support/privacy routes. |

## Controls observed, not reinvented
- Web passwords use Argon2id (legacy PBKDF2 migrated at successful login).
- Session secrets are random; database stores hashes and supports revocation.
- Cookie-based website gateway keeps bearer credentials HttpOnly, SameSite=Strict
  and rejects cross-origin mutation requests.
- Organizer/admin endpoints are role-scoped and require session MFA elevation.
- Telegram Mini App `initData` is signed and validated server-side.
- QR and guest bearer secrets are stripped from organizer roster endpoints.
- PostgreSQL is hosted in a European region; a 5 GB persistent volume is attached.
- Python request logs contain route templates and status, not raw token URLs.
- MFA TOTP secrets are encrypted with a dedicated application key.

## Immediate pre-pilot operational checklist

1. Create an **encrypted, offsite, scheduled** production database backup.
   Rehearse restore on a **separate** PostgreSQL service, verify event, guest
   and ticket counts, and record recovery point/object key without secrets.
2. Audit Postgres public TCP connections; after verifying no remote clients
   need it, remove the public TCP proxy in Railway (retain the private domain).
3. Confirm service secret separation: `BOT_TOKEN` only where necessary,
   `BOT_API_KEY` only Bot and legacy Backend, `RESEND_API_KEY` only Demo API,
   and backup key only in the private backup worker. Never put secrets in
   `NEXT_PUBLIC_*` or GitHub commits.
4. Resolve the repeated Telegram `409` conflict and verify `/start`,
   `/tickets`, `/loyalty` and notifications with one real account.
5. Confirm privacy/terms retention, controller identity, processor contracts,
   incident contact and response SLAs with qualified Czech counsel.
6. Configure deployment/error/storage alerts and periodically review
   dependency-audit results and access changes.
7. Exercise production flows using **test accounts**: signup, Google login,
   MFA, Telegram account link, free ticket, duplicate QR scan, cancellation,
   unauthorized organizer access, and verified deletion request. Never perform
   destructive tests against real user data.

## Release safety
Changes here do **not** modify database schema, erase existing user data, rotate
live credentials or remove public DB routes. Tests must pass before merge. A
read-only audit cannot establish that all external users/data processors meet
GDPR, that an external backup is restorable, or that the service is invulnerable.


## Verified high-priority remediation (2026-10-23)

- A dedicated private Railway backup service encrypts pg_dump archives with AES-256-GCM, uploads to an AMS-region private bucket, downloads the object, confirms SHA-256, decrypts, and validates the archive with pg_restore --list. The first production run was successful; cron interval is twice daily.
- PostgreSQL public TCP proxy was removed after testing the backup worker's private database connection; all internal TicketTreat services remained Online.
- **Key custody is not fully closed** until a business owner saves TT_BACKUP_KEY_HEX from Railway in a separate protected password manager. Losing it prevents restoring encrypted archives.
- **Disaster recovery is not fully proven** until a complete restore to an isolated PostgreSQL instance is rehearsed. Backups stored in the same Railway project are not independent from whole-account compromise.
- See docs/PRODUCTION_OPERATIONS.md for IDs, schedule and first verified object path.
