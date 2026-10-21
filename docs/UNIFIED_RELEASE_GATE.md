# Crowdly: unified release gate (Railway recovery)

**Target source branch:** `feature/crowdly-release-preparation` (based on `crowdly-miniapp-integration`). Do not deploy the older `feature/telegram-mini-app-foundation` branch. Do not auto-merge until the gates below pass.

## Checked against source

| Feature | Source state | Decision |
| --- | --- | --- |
| Web + mobile PWA and Telegram Mini App | Next.js app and Telegram signed auth in PR #3 | Retain this architecture |
| Browser accounts + role chip | account/role UI exists | Verify positioning on actual devices |
| Country and city on account and event | present in forms, geography and feed | Verify existing records with no location |
| Organizers and global admins | ownership-scoped CRUD, CSV, QR check-in | Keep global-admin claims explicit; email alone not an admin grant |
| Free entry | checkout branches for zero-price tickets and QR | Integration-test against DB |
| Photo poster and event description | existing | Retain |
| Global-admin website banner CMS | Implemented in this branch: editable headline, subtitle and stored image | Must test DB/media response in staging; site text currently shared across languages |
| Event photo gallery + external video | added in this branch | External HTTPS links only; no video/file upload |
| Transactional email | Resend outbox for welcome/ticket/check-in | Disabled until sender and credentials verified |
| Scheduled email event reminders | Code added: durable Resend outbox 24h before event; verified email accounts only | Requires real provider + staging confirmation; no marketing email |
| Argon2id, PBKDF2 migration, login rate limits | present | Test with legacy accounts |
| Email verification, password reset | Code + frontend UI added with hashed 8-digit codes and session revocation | Requires Resend configuration and end-to-end tests; production blocker until verified |
| HttpOnly session cookies/BFF | **not implemented**; bearer token in browser storage | Production blocker, review all auth/CSRF semantics |
| MFA/passkeys for admin | **not implemented** | Production blocker for privileged production accounts |
| GDPR export/deletion and retention policies | **not complete** | Production blocker |
| Verified Telegram + email account merge | **not implemented** | Keep separated; no unsafe auto-link |
| Real money payments | **not implemented**; demo checkout only | Must not accept real payments |
| All event content localization | partial | QA four languages |

## Operational sequence

1. Freeze target branch and back up production PostgreSQL, including users, event registrations, tickets and payment states. Confirm restore works on staging.
2. Review all new SQLAlchemy tables. Run a proper migration strategy before production; `create_all` is **not** an existing-table migration.
3. Prepare Railway env vars for the isolated demo API: `DEMO_ISOLATED_API=true`, correct `FRONTEND_ORIGINS`, `WEB_APP_URL`, strong admin recovery credentials, Telegram token reference (server-only), and provider email secrets.
4. Build and test frontend and backend against a staging database. Test participant/organizer/global-admin separation and ensure no real card/payment operation.
5. Deploy isolated Demo API and frontend first, test HTTPS and end-to-end account / QR flows, then update Bot. Do **not** replace existing production Bot/Backend first.
6. Smoke-test browser/mobile/Mini App on staging; confirm free events issue QR without payment; inspect email outbox and opt-in policy before enabling delivery.
7. Enable privileged production access only after ownership verification and security gates. Never grant admin access on an email allowlist alone.
8. Keep the old deployment immutable until rollback and backups have been demonstrated. Deploy single release only after all required external secrets/domains are supplied.

## Acceptance checklist

- [ ] `npm ci && npm run build` for frontend
- [ ] `python -m compileall backend/src bot/src`
- [ ] Python auth and Telegram signature tests pass
- [ ] Media gallery URL validation and event page test pass
- [ ] Database migration tested against an existing database snapshot
- [ ] Browser signup/login and role chip check on mobile
- [ ] Country/city search and existing profiles without location
- [ ] Free ticket / capacity / waitlist / QR / check-in
- [ ] Telegram bot fallback commands + Mini App signed login
- [ ] Session revocation, password upgrade, brute force resistance
- [ ] Test email verification/password reset using real Resend sender; migrate to HttpOnly cookies before public rollout
- [ ] Verify transactional reminders, opt-in for any marketing mail and sender configuration
- [ ] Privacy export/deletion policy and data retention reviewed
- [ ] Rollback and backup restore rehearsed

**Until the unchecked gates pass, keep the PR in draft and do not deploy a public production service.**

## Email verification / reminder behavior on this branch

- New account: can request an 8-digit email verification code from Profile. Existing accounts can use the same flow. Codes expire after 10 minutes and are limited to five attempts. Resend must be enabled/configured; production email deliverability is untested.
- Verified account: may request password reset; a new Argon2id password revokes every previous browser session. An unknown or unverified address receives a generic response.
- New QR booking: if website email is verified and the event is more than one hour away, queue one reminder approximately 24h before the start; an email provider must be configured. The worker skips cancelled events and inactive tickets. Verifying email also queues reminders for upcoming existing bookings.
- Transactional reminders are **not** marketing newsletters. Consent for promotional email and address export requires separate policy/features.
- `demo_verified_emails`, `demo_email_challenges`, and `demo_event_media` are additive SQLAlchemy tables; confirm database privileges and migration outcomes in staging. Do not assume `create_all` changes existing columns.

## Global-admin homepage content

The new `/admin/content` page allows a verified global administrator (with properly granted privileges) to edit homepage title, subtitle and a small JPG/PNG/WebP hero banner. Content is stored in the `demo_site_landing` table and served to the standalone browser site and Telegram Mini App. Larger production media should use object storage. Existing organizer CRUD, role permissions and QR check-in remain unchanged.

## Production hardening changes (2026-10-21)

- Work continues ONLY in `feature/crowdly-release-preparation`; do not use the alternate Vite PR #4 as release source.
- Production configuration now *fails startup* if `DEMO_PAYMENT_MODE=true`; the default has been changed to `false`. Free events are usable; paid events are unavailable until a genuine payment integration exists.
- No unverified website signup may reuse an anonymous guest profile by supplying an email and an old bearer token: this prevents misattribution of QR tickets. A fully verified account-linking flow is still needed for existing guests.
- Production organizer access requires verified email, including participant exports. Setting an organizer role in the signup form does not grant access to participant information before verification.
- Email OTP hashes now use HMAC-SHA256 with required `AUTH_CODE_SECRET` (a strong independent server variable); never publish the key. No OTP features work without it.
- The additive migration is `backend/migrations/20261021_release_preparation.sql`. Apply it to a backed-up staging database before deployment. The GitHub Actions integration job boots a disposable PostgreSQL 16, inspects schema/routes, and executes the migration twice to confirm idempotency.
- **Still blocking a full public release:** cookie/BFF transition for browser bearer tokens; completed verified identity/account merge; systematic security review (especially public guest tokens, anonymous booking limits), privacy retention/export/deletion, actual payment processor with webhook verification, organizer MFA, and real-world SMTP/Telegram/staging tests.


## Single-branch production preparation
- Continue exclusively on feature/crowdly-release-preparation (PR #5); do not modify main until staged checks pass.
- Browser website account sessions now use a server-managed Secure/HttpOnly/SameSite=Strict cookie on the Next.js API gateway. Browser localStorage holds only a non-secret login marker; old tokens require re-login. Anonymous guest/ticket bearer tokens are not yet migrated.
- Configure BACKEND_API_URL on the Next.js service to reach the trusted internal FastAPI Demo API. WEB_APP_URL should eventually point to https://TicketTreat.eu. Do not expose private tokens in NEXT_PUBLIC_* environment variables.
- The gateway enforces same-origin protections for mutations. Telegram signed initData is still verified by the FastAPI backend.
- The signed /demo/telegram/link route explicitly links a verified website account and Telegram session, migrates non-conflicting tickets and waitlist entries, refuses duplicate-event conflicts for manual review, and revokes the former Telegram guest token.
- Email verification and password recovery require AUTH_CODE_SECRET (32+ random characters), as well as verified Resend credentials and provider setup.
- Authenticated /demo/auth/export and a profile JSON download button provide personal-data export; deletion and retention compliance remains unfinished.
- PostgreSQL 16 GitHub Actions exercise startup, table/schema availability, signature-based account linking and repeatable release SQL migration.
- Real money payments and refund workflows, privileged MFA, GDPR deletion and retention, full staging E2E tests and deployment/secrets must be completed before public ticket sales.
