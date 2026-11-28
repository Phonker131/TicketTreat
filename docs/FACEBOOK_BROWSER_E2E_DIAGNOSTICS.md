# Facebook Login UI — browser CI verification

Status: proposed changes in PR #236 targeting the unmerged Facebook frontend PR #233. No production deployment is authorized by this note.

## Why this update exists

CI run 46149702146 for #233 passed TypeScript/build, Python unit tests and PostgreSQL integration, but the Chromium suite failed across existing catalogue, navbar, event SSR and responsive UI cases.

Examples from the log:
- The homepage assertion still expected the retired `.tt-night-kicker` element.
- Mobile nav expected six links, but the current site has seven including Messages.
- Several event tests mocked browser requests but not Next.js server-side event fetching.
- The sticky decorative hero layer intercepted clicks meant for topbar controls.

## Safeguards in this branch

- Update E2E selectors only to reflect currently implemented UI, while retaining assertions about the expected user-visible behavior.
- Isolate SSR event fixture tests in a child API/Next.js server on ephemeral ports, not the shared FastAPI fixture.
- Keep system Chromium override opt-in for local CI parity; GitHub CI continues its own pinned browser.
- Keep the Facebook icon hidden while its backend status endpoint is disabled, and show it alongside Google/Telegram only when explicitly enabled.
- Do not bypass sign-in, email OTP, cookie/CSRF, or existing-account linking controls to satisfy tests.

## Before integrating into #233

1. Require complete CI success (Chromium browser E2E, TypeScript build, Python and PostgreSQL integration).
2. Have a trusted reviewer inspect CSS pointer-event changes, fixture isolation and test assertion modifications.
3. After merging, rerun the main #233 checks. Do not treat this PR's test result as review approval of Facebook OAuth itself.
4. Backend #234 still requires independent code approval and a production-equivalent backup-restore rehearsal before migration or release.
5. Once both parts are approved and safely staged, configure Meta test roles and test the actual Facebook authorization-code flow on a non-production account.
6. Confirm sign-in, email OTP, refusal of duplicate-email auto-linking, account link + MFA, expired state, denied/cancelled login, account ban, and account deletion.
7. Keep Facebook disabled for the general public until Meta access permissions and publication prerequisites are verified.

## Recovery

Keep the API's Facebook capability disabled until the real test passes. If a new deployment shows an unexpected auth failure, disable new Facebook flows by clearing the API service's `FACEBOOK_APP_SECRET` through the secure deployment controls, while preserving all additive identity tables. Do not delete existing users, sessions or tickets as a rollback shortcut.

Reference: `docs/CRITICAL_CODE_AREAS.md` and #234's `docs/FACEBOOK_LOGIN_SECURITY_REVIEW.md`.
