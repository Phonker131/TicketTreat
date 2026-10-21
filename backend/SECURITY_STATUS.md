# TicketTreat — security implementation and remaining risks

**Status:** engineering implementation in progress; not a security certification. The chosen release branch is `feature/crowdly-release-preparation`.

## Implemented and covered by source/CI

- Argon2id for website passwords; upgrade legacy PBKDF2 records on valid login.
- Server-side account roles/ownership and PostgreSQL-backed rate limiting for selected authentication endpoints.
- Website session tokens hashed in PostgreSQL; browser session delivered through an HttpOnly, Secure (production), SameSite=Strict cookie via Next.js.
- Email ownership verification and password recovery with expiring, server-keyed OTP HMAC and session revocation. A configured `AUTH_CODE_SECRET` and a verified Resend sender are required.
- Signed Telegram Mini App `initData` validation; explicit dual-identity linking with conflict checks.
- Verified identity required for production event booking. Fake paid checkout disabled when `APP_ENV=production`.
- Participant-data exports and event owner authorization are server-side. Browser UI checks do not grant permissions.
- No-store headers for sensitive API responses; CI covers Python, TypeScript/Next and PostgreSQL integration.

## Important limitations

- Anonymous guest access tokens and old QR-ticket URLs still require a full authorization and abuse review.
- MFA/passkeys are not implemented for global administrators and organizers.
- Account deletion/retention schedules and GDPR operational processes are incomplete; data export alone does not satisfy all obligations.
- Full CSP/XSS, CSRF, dependency, intrusion-monitoring, incident-response, recovery and secret-rotation audits remain.
- Existing legacy Bot/Backend access control needs separate verification.
- Email deliverability/bounces, the Telegram transport and Railway infrastructure have not been validated end-to-end against a production-like staging environment.
- No real payment provider, settlement, verified webhooks or refunds: **do not accept real paid ticket sales.**

See [release gates](../docs/UNIFIED_RELEASE_GATE.md) for deployment checks. Never commit live credentials or personal data.
