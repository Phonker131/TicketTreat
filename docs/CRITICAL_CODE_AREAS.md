# TicketTreat — critical code and collaboration boundaries

**Maintainer:** `@Phonker131`. **Production branch:** `release/tickettreat-production`.
This is a review map, NOT a complete security audit, and not an access-control mechanism.

| Area | Main files | Why owner review is required |
| --- | --- | --- |
| PostgreSQL sessions / models | `backend/src/db/session.py`, `backend/src/db/models.py`, `backend/src/db/base.py` | Connection pooling, schema identity, ticket/event relationships |
| Applied migrations / DDL | `backend/migrations/*.sql`, `backend/migrations/apply.py` | Migration checksums, advisory locks, uniqueness and transaction safety |
| Backend API / registration / check-in | `backend/src/main.py`, `backend/src/demo_roles.py`, `backend/src/demo_principal_api.py`, `backend/src/demo_waitlist_offers.py` | Access scope, booking capacity, concurrency, QR replay and event ownership |
| Account login / passwords / OAuth | `backend/src/demo_accounts.py`, `backend/src/demo_auth_security.py`, `backend/src/demo_google.py`, `backend/src/demo_account_recovery.py` | Password hashing, token lifetimes, brute-force limits, state/PKCE and account linking |
| MFA / Telegram linking / privacy | `backend/src/demo_mfa.py`, `backend/src/demo_telegram.py`, `backend/src/demo_privacy.py` | Privileged authentication, signed initData, erasure/export and personal data |
| Website gateway / cookies | `frontend/app/api/**`, `frontend/lib/session.ts`, `frontend/lib/api.ts`, `frontend/next.config.mjs` | HttpOnly session boundary, redirects, CSRF, origin allowlists and security headers |
| Telegram Bot | `bot/src/webhook_runtime.py`, `bot/src/main.py` | Webhook secret, bot permissions, participant identity and QR admissions |
| Backups / recovery | `scripts/backup_postgres.py`, `scripts/offsite_backup.py`, `scripts/restore_offsite_backup.py`, `scripts/staging_restore_drill.py` | Encryption, handling of DB credentials, restore destination and data loss |
| CI / deployments | `.github/workflows/**`, `.github/CODEOWNERS` | Production release gates and self-protection of the ownership policy |

## How to interpret the in-code comments

Look for `TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED`. It means **not safe to modify casually**, not "never modify". Changes are possible with a reviewed design, tests and owner approval.

For a protected change, describe the threat model / migration impact, submit a PR, ensure all CI checks pass and obtain an explicit approving review. For DB schema or data changes, also document backup, staging dry-run and rollback/forward recovery.

Do not edit historical SQL migrations after application. Create a new migration and preserve the checksum ledger. No operator should disclose `DATABASE_URL`, session signing secrets, Telegram bot token, or backup decryption key to a casual contributor.

## Administrator action required (GitHub UI)

1. In `Settings → Rules → Rulesets` (or `Settings → Branches` if rulesets are unavailable), create a branch ruleset targeting **`release/tickettreat-production`**.
2. Enable **Require a pull request before merging**, **Require approvals** (one trusted owner review), **Require review from Code Owners**, and **Dismiss stale approvals** when new commits are pushed.
3. Require passing checks: Python tests, PostgreSQL integration, TypeScript production build, Chromium browser end-to-end, and SEO contracts (verify exact current check names).
4. Disable force pushes / deletions, and do not grant routine collaborators bypass permission. Make sure administrators follow the same review rules where appropriate.
5. Test with a disposable PR that touches a protected path; verify code-owner review is actually required before merge. Check that normal noncritical UI PRs remain straightforward.

**GitHub CODEOWNERS by itself only requests a review.** Do not state that write access or merging is technically restricted until the actual repository rule is enabled and tested. On this repo the default branch is still `main`; reviewers must target the release branch.

No payments or Apple Wallet changes are part of this policy.
