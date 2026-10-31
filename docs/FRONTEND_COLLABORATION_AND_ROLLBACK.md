# TicketTreat — frontend/design collaboration and rollback

This is the approved **free-pilot** contribution workflow. It does not grant GitHub permissions or automatically enforce branch protection. The repo owner must invite a collaborator with **Write** access and enable the repository ruleset.

## Branches and deployment

| Branch | Purpose | Production deployment? |
| --- | --- | --- |
| `release/tickettreat-production` | Live application on Railway | **YES** — merges may trigger automatic deploys for Frontend, API, Bot, Backend and backup worker |
| `dev/frontend-design` | Shared workspace for UI, layouts, copy and styling | **NO** — no production deploy for changes pushed here |
| `backup/production-2026-10-31-pre-collaboration` | Frozen source snapshot of commit `acfc225881b519b5a77b7fa71e5135ecb0dba8cf` | **NO** — do not develop or merge into this branch |
| `main` | GitHub default / legacy entry point | Not the production source; do not merge or deploy from it by mistake |

The backup branch includes Git source, app configuration **stored in Git**, and SQL migration files as of 31 October. **It does NOT back up production PostgreSQL rows, credentials, Railway variables, external storage, Resend, or Telegram state.** The encrypted DB backup worker has a separate restore procedure in `docs/PRODUCTION_OPERATIONS.md`. Restoring old code against a migrated DB may be unsafe; never rewind production database automatically.

## What a frontend collaborator can modify freely

Work under `dev/frontend-design`, or create `feature/<short-ui-topic>` from the current `release/tickettreat-production` commit:

- `frontend/components/**` — event cards, navigation, forms, dialogs, typography and responsive layout (**UI only**, not client-side security assumptions).
- `frontend/app/**/*.css`, `frontend/app/globals.css` and brand styles — color, spacing, typography, animations.
- `frontend/public/**` — brand graphics, illustrations and other **public/nonsecret** assets.
- `frontend/app/**/page.tsx`, `frontend/app/**/layout.tsx` — public/UI presentation, metadata and page structure, **excluding API routes and security controls**.
- User-visible copy/localizations that do not modify access permissions or secrets.

These paths are **not owned by `@Phonker131` in CODEOWNERS merely because they are UI**. The contributor can implement, commit and push UI changes without asking permission for every edit. They must still create a PR to release and allow tests/production release review; actual enforcement depends on branch rules.

## What requires explicit owner review

- `backend/**`, `backend/migrations/**`, `bot/src/**`, `scripts/**` — database, accounts, APIs, registrations, capacity, ticket QR check-in, Telegram bot and encrypted backup/restore.
- `frontend/app/api/**` — auth callback and server-side API gateway.
- `frontend/lib/session.ts`, `frontend/lib/api.ts`, `frontend/lib/telegram.ts`, `frontend/next.config.mjs`, `frontend/middleware.ts` — identities, cookies, security headers and middleware.
- `frontend/package.json` and `frontend/package-lock.json` — dependency/supply-chain changes.
- `.github/workflows/**`, `.github/CODEOWNERS` — CI and code ownership policies.

All backend and sensitive files are governed by `.github/CODEOWNERS`; many contain `TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED` banners. **The comments only warn; they do not block a push or a merge.** Branch rules must enforce code-owner review, CI and PR-only merging. A teammate with Write permission can otherwise edit critical code.

## Recommended everyday work

1. Owner adds colleague at **Settings → Collaborators → Add people** using their GitHub username and gives Write access. Never give personal credentials, production database URL or Railway secrets.
2. Colleague checks out `dev/frontend-design` and works on UI, or creates `feature/ui-...` based on the latest release. They can push repeatedly to their branch; this does **not** redeploy production.
3. Colleague opens a **Pull Request with base `release/tickettreat-production`** (never `main`). UI-only PRs do not match the security-critical CODEOWNERS entries.
4. GitHub CI runs TypeScript/build, Chromium E2E, SEO, Python and PostgreSQL tests. The PR template explicitly marks "no DB/auth/security changes".
5. Owner or designated release manager checks the visual result and merges after tests. Railway deploys production from release; verify its status.
6. After each accepted PR, **sync `dev/frontend-design` from release** (fast-forward when possible; otherwise rebase/merge in a new PR). Do not force-reset the colleague's working branch.

## Configure GitHub rules (owner UI action still required)

Open GitHub **Settings → Rules → Rulesets** (or **Settings → Branches**, depending on UI). Target **only `release/tickettreat-production`**, not `dev/frontend-design`:

- Require a Pull Request for changes and passing CI checks before merging. The owner can review normal UI changes at release time without controlling day-to-day edits in the dev branch.
- Require CODEOWNERS review for sensitive files by `@Phonker131`, and disallow force pushes and branch deletion.
- Do **not** disable review / CI for critical paths. Code-owner review is NOT active just because the file exists.
- Apply a **separate rule for `backup/production-2026-10-31-pre-collaboration`** to block updates, force-pushes and deletion. Only the owner should maintain backup refs.
- IMPORTANT: On a personal repository with a sole CODEOWNER, the owner cannot approve their *own* PR. Test the rule using a noncritical PR and a critical-file test PR. Decide how an authorized emergency bypass or a second trusted reviewer works before fully enforcing it.
- Keep `dev/frontend-design` open for collaborator Write pushes; do not attach production deployments to it.

We did not programmatically change repository rulesets or invite anyone. Those GitHub administrative actions require explicit owner permissions and verification.

## Rollback if a UI release breaks

- Prefer **revert the single bad PR on `release/tickettreat-production`**, run CI, merge and verify Railway again. This preserves newer successful changes.
- For an emergency full source rollback, create a new recovery branch from the saved backup SHA, inspect migration/API compatibility and prepare a reviewed PR. Do **not** blindly force-push production, rewrite SQL history, or overwrite the database.
- DB restore is a separate incident operation requiring a verified, encrypted backup and isolated rehearsal; see `docs/PRODUCTION_OPERATIONS.md`.

**Scope:** website UI and design contributions. Platform payments and Apple Wallet stay outside the free-pilot work.
