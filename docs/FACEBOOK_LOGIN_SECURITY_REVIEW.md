# TicketTreat — Facebook Login rollout and owner review

**Risk class:** Critical authentication, personal data, database migration, and public BFF cookies. **Maintainer approval:** `@Phonker131`. **Status:** proposal only, not production enabled.

## Scope / threat model

- OAuth authorization-code flow against Meta Graph API v27.0. Server uses the app secret; browser only receives a Meta authorization URL. Tokens and secrets never enter URLs to TicketTreat, browser storage, or logs.
- One-time `state` is stored hashed in PostgreSQL and paired to a separate browser proof in a 10-minute HttpOnly `SameSite=Lax` cookie. Flow is consumed **before** exchanging the code, preventing callback replay and login CSRF.
- Exchange code only at Meta's fixed Graph endpoint; independently validate Meta `/debug_token` (`is_valid`, app audience, token type, expiry, user ID), then `/me` user ID must match. Use `appsecret_proof` when fetching the profile. Ignore user-supplied profile IDs and claims.
- Existing TicketTreat accounts are NEVER auto-merged or claimed based on matching email/name. Account linking requires an authenticated session, current TicketTreat password and privileged MFA where needed; confirmation rechecks the original live session and MFA.
- If a Facebook ID is unknown and email is available, send an 8-digit TicketTreat email OTP. **Do not create an account until OTP and explicit terms/privacy acknowledgement pass.** OTP is HMAC-hashed with `AUTH_CODE_SECRET`, five attempts max, expires in 10 minutes, and onboarding requires an independent high-entropy HttpOnly browser cookie. The account starts as a participant with a non-login password placeholder; the email is verified by TicketTreat's OTP.
- Refuse first-time signup if Meta does not return email or if an account already owns it. Explain to use email login then link Facebook. No friendship, social feed or advertising scopes. Login remains disabled if the app secret or redirect is absent.
- New app-scoped IDs and in-progress flows are deleted through the account erasure workflow. Public `/data-deletion` page explains both authenticated and no-login requests. Meta app removal alone does not equal automatic account erasure.

## Required runtime configuration

| Railway service | Variable | Value |
| --- | --- | --- |
| TicketTreat API | `FACEBOOK_APP_ID` | Meta App ID (public) |
| TicketTreat API | `FACEBOOK_APP_SECRET` | Set only through Railway's secret UI, **never chat/Git** |
| TicketTreat API | `FACEBOOK_REDIRECT_URI` | `https://tickettreat.eu/api/auth/facebook/callback` |
| Frontend | `FACEBOOK_APP_ID` | Same Meta App ID |
| Frontend | `FACEBOOK_REDIRECT_URI` | Same redirect URI |

The API also requires existing `AUTH_CODE_SECRET`, Resend transactional email setup, and migration `20261128_facebook_oauth.sql`. Do not use a `NEXT_PUBLIC_` secret. Meta valid redirect must match exactly. Confirm `email` permission is active and the app is available to the intended tester roles before live release.

## Migration, backup, verification and recovery

1. Create and verify a fresh encrypted PostgreSQL backup with restore instructions. Dry-run the additive migration on a disposable/staging restore first. It creates `demo_facebook_identities`, `demo_facebook_flows`, and `demo_facebook_pending` (including unique subject/account constraints); no existing account/ticket rows are modified.
2. Run `test_facebook_auth.py`, existing Google/Telegram/auth/ban/privacy tests, PostgreSQL `integration_facebook.py` and `integration_google.py` against **only** `/tickettreat_ci`, TypeScript production build, and Chromium E2E for three social icons plus email OTP verification. The tests may use a non-production Meta test application; never run OTP against real users for CI.
3. Obtain owner approval of this PR and check Code Owners/branch rules. Stage the API first while `FACEBOOK_APP_SECRET` is unset, apply the migration safely, then publish Frontend behind disabled `status`. Set secrets only after verified configuration and approved manual test accounts. Confirm known/unknown Facebook user login, linked account, wrong browser, duplicate email, expired OTP, banned account, organizer/admin MFA and erasure handling.
4. **Rollback:** unset API `FACEBOOK_APP_SECRET` to disable new flows immediately; redeploy the prior API/Frontend release if needed. Keep additive tables rather than dropping user identities during rollback. Pending OTPs expire within 10 minutes. Never reset/migrate/delete production account data as a rollback shortcut.

## Launch blockers / legal approvals

- TicketTreat's legal operator/controller details and an approved GDPR retention schedule must be accurately published on `/privacy-policy` before Meta public review (not merely placeholder legal wording).
- Public data-deletion instructions must be deployed and manually verified at `/data-deletion`, including the privacy mailbox receiving messages.
- Meta App Review/access permissions and Live mode must match the intended target audience. Verify exact review requirements in the current Meta dashboard.
- Test a full live code exchange with real app credentials in a controlled staging setup; mocks alone do not prove Meta authentication works.
