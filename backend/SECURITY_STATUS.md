# TicketTreat — security implementation and remaining risks

**Status:** TicketTreat is deployed in production; this engineering note is not a security certification. The maintained release branch is `release/tickettreat-production`. See `docs/SECURITY_AUDIT_2026-10-23.md` and `docs/PRODUCTION_OPERATIONS.md` for the latest verified controls and remaining work.

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

## Incremental hardening: 2026-10-21

- Ticket, checkout, cancellation, waitlist and guest profile routes require **current verified website credentials or signed Telegram launch data** matching the guest when `APP_ENV=production`. A previously copied `guest_token` is not sufficient by itself.
- Production disables anonymous demo guest creation and legacy shared-key admin operations; organizer management remains account-scoped.
- Event capacity changes use the Event row as the shared PostgreSQL lock across web checkout, bot registrations and waitlist promotion. Concurrent last-seat test is run in CI.
- Website data-erasure request/withdrawal supports password confirmation; it is a tracked request, not automated deletion. Actual data erasure, retention/legal holds and privacy operations are not completed.
- Global-admin recovery and participant/organizer role changes write a non-secret audit record. MFA/passkeys are **not** implemented.
- Browser CSP is report-only for compatibility testing with Telegram and dynamic images. Do not misrepresent this as a fully enforced, audited CSP.
- Database readiness is available under `/demo/health/ready`; a checksum-tracked SQL migration runner is under `backend/migrations/apply.py`.
