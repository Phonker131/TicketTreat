# Crowdly Demo — current account and personal-data security

## Implemented
- New passwords: Argon2id (19 MiB, t=2, parallelism=1, randomly salted).
- Existing PBKDF2-HMAC-SHA256 password hashes: verified normally, transparently rehashed into Argon2id at the next successful login. No password reset or destructive database migration required.
- New passwords: minimum 12 characters, maximum 128 characters, spaces/passphrases supported.
- Login and signup throttling in PostgreSQL, not in-memory. Password guessing limits work across deploys/replicas. Only hashes of rate-limit bucket identifiers are kept.
- Global-admin recovery throttled separately.
- New sessions: random 36-byte token, only SHA-256 of token held by PostgreSQL, seven-day lifetime and up to five active sessions per account. Older sessions keep their existing expiration dates until revoked or expiry.
- Change-password: requires current password, revokes every old session and issues a fresh token.
- Log out all devices: revoke all account sessions on the server.
- Private API responses: Cache-Control no-store, nosniff, no-referrer, restricted permissions.
- PWA: caches only public icons and Next.js static assets, no page navigation or personal data. Old cache versions removed on service-worker activation.
- Website security headers: HTTPS HSTS, nosniff, no-referrer and restricted permissions without blocking Telegram Mini App / organizer QR scanner.

## Deployment checklist
1. Back up PostgreSQL.
2. Deploy Demo API first. The new demo_auth_rate_buckets table is added automatically.
3. Check /docs, server logs and existing account login (PBKDF2 is upgraded on success).
4. Deploy frontend and reload the application so the new service worker clears old cached pages.
5. Test: incorrect passwords -> HTTP 401, rate limit -> HTTP 429, password change invalidates prior sessions, logout-all invalidates the current one. Verify organizer role remains intact.

## NOT YET solved — required before a public production launch
- Existing browser authentication token and demo guest access token are still kept in JavaScript-accessible localStorage. Move to a same-origin Backend-for-Frontend proxy and Secure/HttpOnly/SameSite cookies to reduce XSS token theft. This needs coordinated changes across frontend and backend.
- Website email ownership verification and reliable password reset are not implemented.
- MFA/passkeys (especially for organizers/global admins) are not implemented.
- GDPR: retention schedule, right-to-erasure workflow, consent/legal notices, purpose-based access and backup restoration drill remain to be completed.
- Protect and audit older Telegram bot / legacy backend API separately; this hardening targets the isolated Demo API web accounts.
- Independent penetration testing, security monitoring, alerting, incident response and key rotation remain necessary.

Never store API keys or account passwords in GitHub or in this document.
