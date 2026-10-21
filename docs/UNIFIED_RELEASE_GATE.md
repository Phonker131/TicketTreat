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
