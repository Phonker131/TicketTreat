# Contributing to TicketTreat

TicketTreat is deployed to Railway from **`release/tickettreat-production`**, NOT from the GitHub default branch `main`. A merged change to the release branch can trigger a real deployment.

## Frontend/design collaboration

Use the shared `dev/frontend-design` branch for UI experiments without triggering Railway production deployments, or create a short-lived feature branch from the current release. `frontend/components/**`, CSS, public assets and UI pages are free-edit areas; database, auth and security protocols are owner-reviewed. Keep any working branch up to date before submitting a PR.

**Snapshot for code rollback:** `backup/production-2026-10-31-pre-collaboration` at `acfc225881b519b5a77b7fa71e5135ecb0dba8cf`. This is **source only**, not a PostgreSQL data backup. Do not push to or delete it.

Full step-by-step instructions: [frontend/design collaboration and rollback](docs/FRONTEND_COLLABORATION_AND_ROLLBACK.md).

## Safe collaboration

1. Create a short-lived branch from `release/tickettreat-production` (for example `feature/event-card-layout`).
2. Make ordinary UI/content/localization changes on that branch. Keep each PR narrowly scoped.
3. Open a PR **targeting `release/tickettreat-production`**; do not push directly to that branch.
4. Wait for all required GitHub CI checks and an approving review before merging.
5. The repo owner coordinates production releases, data migrations, secret rotation and rollback.

### Restricted areas — get approval before changing

Database connections, schema, migrations, SQL locks and capacity constraints; password hashing; sessions and HttpOnly cookies; Google OAuth and Telegram signature verification; access roles and privileged MFA; account linking; QR check-in; identity/privacy exports; token handling; backup encryption and restoration; security response headers; CI/deployment configuration.

See [`docs/CRITICAL_CODE_AREAS.md`](docs/CRITICAL_CODE_AREAS.md) and [`.github/CODEOWNERS`](.github/CODEOWNERS) for specific files and their risks.

**Important:** A source comment or CODEOWNERS entry is not a technical access restriction. The owner must separately activate branch protection/rulesets requiring PRs, passing checks and code-owner approvals. Do not treat these notices as evidence that the repository is protected.

### Database changes

- Never edit an already applied SQL migration: `backend/migrations/apply.py` verifies checksums and requires immutable history.
- Add a new sequential migration **only** after DBA/owner review and backup + restoration planning.
- Do not run schema-changing or destructive scripts against production from a local machine or a PR.
- Test with an isolated database and the PostgreSQL integration suite; document rollback/forward recovery.

### Security changes

- Preserve HttpOnly/Secure/SameSite cookies, origin/CSRF checks, hashed credentials, signed Telegram `initData`, role/ownership rules, rate limits and QR replay protection.
- Never expose raw session tokens, API keys, personal data, DB URLs, or backup encryption keys in commits, tests, screenshots or logs.
- Do not disable security tests, remove authorization checks or weaken production CSP/security headers without an explicit risk review.
- Never use real production user data for local testing.

### PR review

Explain user-facing changes, security/DB implications (or explicitly say **none**), the tests run, and any migration or deployment risk. Use the PR template. If a protected file must change, request review from `@Phonker131` before merging.

Changes to payment processing and Apple Wallet are out of scope for the current free pilot.
