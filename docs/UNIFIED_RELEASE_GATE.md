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
| Event photo gallery + external video | added in this branch | External HTTPS links only; no video/file upload |
| Transactional email | Resend outbox for welcome/ticket/check-in | Disabled until sender and credentials verified |
| Scheduled email event reminders | **not implemented** | Separate feature; do not advertise as active |
| Argon2id, PBKDF2 migration, login rate limits | present | Test with legacy accounts |
| Email verification, password reset | **not implemented** | Production blocker |
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
- [ ] Email verification/reset and cookies before public rollout
- [ ] Email sending consent, sender verification and reminders before claiming these features
- [ ] Privacy export/deletion policy and data retention reviewed
- [ ] Rollback and backup restore rehearsed

**Until the unchecked gates pass, keep the PR in draft and do not deploy a public production service.**
