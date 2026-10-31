# TicketTreat — frontend/design collaboration and rollback

This is the approved **free-pilot** contribution workflow. It does not grant GitHub permissions or automatically enforce branch protection. The repo owner must invite a collaborator with **Write** access and enable the repository ruleset.

## Branches and deployment

**Live pilot configuration (31 October 2026):** Railway Frontend is connected to `dev/frontend-design` in the existing production environment, serving `https://tickettreat.eu`. The Backend, TicketTreat API, Bot and backup worker stay on `release/tickettreat-production`. No new Railway service or paid environment was created. **This is a live site, not an isolated preview.** Frontend commits that introduce incompatible API calls or break authentication can disrupt the pilot even though the database code is unchanged; do not modify auth/gateway/session or dependencies casually.

| Branch | Purpose | What is deployed to Railway? |
| --- | --- | --- |
| `release/tickettreat-production` | Reviewed server / production source | **Backend, TicketTreat API, Bot and backup worker** follow this branch. Frontend does **not** follow it automatically during the UI pilot. |
| `dev/frontend-design` | Live shared UI/design workspace | **YES — the existing Railway Frontend service and `https://tickettreat.eu`** follow this branch; each frontend push may deploy publicly, without a PR or required CI today. |
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

These paths are **not owned by `@Phonker131` in CODEOWNERS merely because they are UI**. The contributor can implement, commit and push UI changes without asking permission for every edit. **That push can immediately update the public website**; they should verify the build and test the pages at `https://tickettreat.eu`. For a reviewed release of source history, also open a PR to the release branch. Neither CODEOWNERS nor CI currently blocks a direct push to this shared dev branch.

## What requires explicit owner review

- `backend/**`, `backend/migrations/**`, `bot/src/**`, `scripts/**` — database, accounts, APIs, registrations, capacity, ticket QR check-in, Telegram bot and encrypted backup/restore.
- `frontend/app/api/**` — auth callback and server-side API gateway.
- `frontend/lib/session.ts`, `frontend/lib/api.ts`, `frontend/lib/telegram.ts`, `frontend/next.config.mjs`, `frontend/middleware.ts` — identities, cookies, security headers and middleware.
- `frontend/package.json` and `frontend/package-lock.json` — dependency/supply-chain changes.
- `.github/workflows/**`, `.github/CODEOWNERS` — CI and code ownership policies.

All backend and sensitive files are governed by `.github/CODEOWNERS`; many contain `TICKETTREAT CRITICAL — OWNER REVIEW REQUIRED` banners. **The comments only warn; they do not block a push or a merge.** Branch rules must enforce code-owner review, CI and PR-only merging. A teammate with Write permission can otherwise edit critical code.

## Recommended everyday work

1. Owner adds colleague at **Settings → Collaborators → Add people** using their GitHub username and gives Write access. Never give personal credentials, production database URL or Railway secrets.
2. Colleague checks out `dev/frontend-design` and works on the UI. **A push to this exact branch triggers the existing Frontend Railway deployment to the public `tickettreat.eu` domain.** A push to `feature/ui-...` alone does **not** display on the website until the change is merged into `dev/frontend-design`.
3. Colleague visually checks the public website after Railway reports `SUCCESS`. For a reviewed release snapshot they open a **Pull Request with base `release/tickettreat-production`** (never `main`). UI-only PRs do not match the security-critical CODEOWNERS entries.
4. GitHub CI runs TypeScript/build, Chromium E2E, SEO, Python and PostgreSQL tests. The PR template explicitly marks "no DB/auth/security changes".
5. Owner or designated release manager checks the UI and merges after tests. This updates the reviewed source and may deploy server services only if their watched files changed; **the live Frontend continues to follow `dev/frontend-design`**.
6. Keep `dev/frontend-design` synced with release after backend or configuration updates (fast-forward when possible; otherwise merge deliberately). **Do not force-reset the colleague's work or replace the live Frontend branch without checking what is currently displayed.**

## Before publicly testing new UI

- Make a small UI-only change and push to `dev/frontend-design`; confirm the Railway Frontend deployment reports `SUCCESS` and inspect `https://tickettreat.eu` on desktop and mobile.
- If the build fails, inspect Railway logs and revert the change on `dev/frontend-design`.
- The Frontend does **not wait for CI** as currently configured (Railway source reports `checkSuites=false`). GitHub test results help diagnose regressions but **do not gate the live deployment**.
- Only the Frontend tracks this UI branch; publishing front-end JavaScript can still affect browser sessions and user privacy. Do not place credentials or private data in `NEXT_PUBLIC_*` or public assets.
- If an approved UI change also alters API routes, authentication, ORM models, Bot logic or database migrations, take it through reviewed release PRs instead of publishing the risky part directly from dev.

## Configure GitHub rules (owner UI action still required)

Open GitHub **Settings → Rules → Rulesets** (or **Settings → Branches**, depending on UI). Target **only `release/tickettreat-production`**, not `dev/frontend-design`:

- Require a Pull Request for changes and passing CI checks before merging. The owner can review normal UI changes at release time without controlling day-to-day edits in the dev branch.
- Require CODEOWNERS review for sensitive files by `@Phonker131`, and disallow force pushes and branch deletion.
- Do **not** disable review / CI for critical paths. Code-owner review is NOT active just because the file exists.
- Apply a **separate rule for `backup/production-2026-10-31-pre-collaboration`** to block updates, force-pushes and deletion. Only the owner should maintain backup refs.
- IMPORTANT: On a personal repository with a sole CODEOWNER, the owner cannot approve their *own* PR. Test the rule using a noncritical PR and a critical-file test PR. Decide how an authorized emergency bypass or a second trusted reviewer works before fully enforcing it.
- `dev/frontend-design` **is** currently the source of the public Frontend. Keep day-to-day UI pushes possible, but treat any change in this branch as a potential public website release. A branch-protection/ruleset for this branch and an approval-before-merge policy are necessary if the owner wants preventive enforcement rather than trust-based direct pushes.

We did not programmatically change repository rulesets or invite anyone. Those GitHub administrative actions require explicit owner permissions and verification.

## Rollback if a UI release breaks

- For broken **live UI**, revert the offending commit on `dev/frontend-design` (or restore known-good UI files from the backup snapshot), push the fix and verify Frontend Railway `SUCCESS`. A revert on the release branch alone will NOT redeploy the live Frontend while Railway tracks the dev branch. For backend problems, revert the reviewed release PR separately and verify server deployments.
- For an emergency full source rollback, branch from the **current release head**, then restore the selected files from `backup/production-2026-10-31-pre-collaboration` using `git restore --source origin/backup/production-2026-10-31-pre-collaboration -- frontend/` (adjust the paths deliberately), commit the restoration and open a reviewed PR. A PR from the old snapshot branch alone will NOT revert newer commits, because it is behind release. Inspect migration/API compatibility and run CI. Do **not** blindly force-push production, rewrite SQL history, or overwrite the database.
- DB restore is a separate incident operation requiring a verified, encrypted backup and isolated rehearsal; see `docs/PRODUCTION_OPERATIONS.md`.

**Scope:** website UI and design contributions. Platform payments and Apple Wallet stay outside the free-pilot work.
