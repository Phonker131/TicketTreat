# Crowdly — Security Status (Demo MVP)

## Implemented in the demo branch

- **Password storage:** Argon2id (19 MiB, 2 passes, parallelism 1) with a random salt; passwords are never stored in plaintext.
- **Backward compatibility:** existing PBKDF2-HMAC-SHA256 hashes are verified and automatically replaced with Argon2id after successful authentication. Password resets are not forced.
- **Credential policies:** new passwords must be at least 12 characters and at most 128 characters.
- **Brute-force mitigation:** login/signup/global-admin recovery and password-change attempts are rate-limited in PostgreSQL across server instances. Rate keys are SHA-256 digests; raw login identifiers and IP addresses are not stored in the limiter table.
- **Sessions:** cryptographically random bearer tokens, stored as SHA-256 digests in PostgreSQL, with logout/revocation. New sessions expire after 7 days, maximum 5 per account. Earlier sessions keep their existing expiry until they naturally expire or are revoked.
- **Compromise recovery:** change password (verifying the old password), revoke all sessions, and issue a new token; separate sign-out-everywhere action.
- **Access restrictions:** organizer/global-admin access to event management is verified in the API against event ownership, not based on hidden UI controls. Legacy shared admin endpoints are blocked on the isolated Demo API.
- **Private-data cache policy:** sensitive API responses and Next.js profile/admin/ticket/checkout routes carry no-store headers. PWA service worker caches only static images and immutable Next.js assets, never personal pages.
- **Browser defenses:** nosniff, no-referrer, HSTS, and restricted permissions policy.
- **Test coverage:** backend/src/tests/test_demo_auth_security.py includes tests for new hashes, legacy hashes, malformed hashes and password length.

## Still required before public launch

1. **Migrate browser sessions to same-site, Secure, HttpOnly cookies** through a same-origin backend-for-frontend (BFF). Current browser auth tokens are stored in localStorage and can be stolen by injected JavaScript. Plan CSRF and cookie scope together. Do not set cross-site cookies blindly on railway.app domains.
2. **Verify email addresses** before giving full account trust, sending messages or allowing account recovery. Implement reset-password and ownership verification.
3. Add **phishing-resistant MFA/passkeys** for global administrators and organizers with access to private participant lists.
4. Add account data **download/deletion and retention schedules**, minimization, audit of personal-data access, and GDPR-compatible privacy notices.
5. Finish a **CSP rollout** (report-only first), security test suite, dependency alerts, periodic secret rotation and backup-restore testing.
6. Review anonymous guest tokens, ticket links, all public APIs, CSV exports and QR flows for authorization and abuse prevention.
7. Add delivery/bounce handling before enabling transactional email publicly; mailer remains disabled until configured separately.

## Deployment and testing

Do not merge this demo PR to main until:
- Railway **Demo API** and **Frontend** deploy successfully;
- PBKDF2 legacy-account login is tested and transparently rehashed;
- new signup, login, session expiry, password change, logout-all and admin ownership are exercised;
- browser cache and PWA offline behavior are confirmed;
- PostgreSQL has a verified backup and restoration procedure.

Commands to run in a Python 3.12 environment:

    cd backend/src
    pip install -r requirements.txt
    python -m compileall -q .
    PYTHONPATH=. python -m unittest discover -s tests -p 'test_demo_auth_security.py'

Do not commit real credentials, Railway variables or user data. This document intentionally contains no secrets.
