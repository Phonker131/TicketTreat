# Google sign-in

Google login and first-time registration use the existing website accounts, guests,
tickets and revocable HttpOnly sessions. Google identities are keyed by `sub`.
Existing accounts must sign in by password and explicitly link Google in Profile →
Account security, confirming their password (plus privileged MFA when required).
Matching email alone never merges accounts or transfers tickets.

## Enable

1. In Google Cloud create/select your project, configure Google Auth Platform branding,
   audience and contact details, and create an OAuth client of type **Web application**.
2. Add the exact authorized redirect URI, for example
   `https://tickettreat.eu/api/auth/google/callback`. Use your actual frontend hostname.
   Request only `openid email profile`. While the consent app is in Testing, add test users.
3. On the backend set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
   On the frontend set the same `GOOGLE_REDIRECT_URI` and the existing `BACKEND_API_URL`.
   Never put the secret in public frontend variables or commit it to Git.
4. Follow the existing backup/migration procedure and run
   `python backend/migrations/apply.py` with the target `DATABASE_URL` before rollout.
   New migration: `20261021_z_google_oauth.sql`. It adds only new tables.
5. Deploy the backend and frontend from the same reviewed revision.
   The button appears only when the backend configuration is present. Run a real
   Google login before enabling the feature publicly.

Local development can use `http://localhost:3000/api/auth/google/callback`
with `APP_ENV=development`, a matching Google redirect, and the same hostname in
all browser requests. Production requires HTTPS.

## Behavior and security

- Authorization code with S256 PKCE, state, nonce, ten-minute browser-bound flow,
  atomic single-use consumption, and Google library signature/expiry/issuer/audience checks.
- PKCE verifier is in an HttpOnly, SameSite=Lax ten-minute cookie. Backend stores its hash.
  Website bearer token remains in the existing HttpOnly, SameSite=Strict gateway cookie.
  Callback never puts bearer credentials in a URL or browser storage.
- Fresh Google sessions do not inherit any MFA elevation. Existing privileged API
  checks still apply. New users always get the participant role.
- Gmail and Google Workspace email addresses can be marked verified. External email
  addresses still use the existing email-verification process: Google may no longer
  be authoritative for ownership of such an address.
- Google-only accounts have no usable password. To set a password for password login
  or MFA enrollment, first verify the profile email if necessary, then use password
  recovery. This requires the existing email provider to be configured.
- Google OAuth runs in a regular browser; Telegram's embedded browser shows guidance
  to open the website externally. Existing Telegram login and explicit Telegram linking
  remain available.
- Deletion fulfilment removes Google identity bindings and pending linking flows.
- Retain no Google access/refresh tokens. Periodically delete expired
  `demo_google_flows` rows; starts also remove expired flows automatically.
- Do not retain query strings for `/api/auth/google/callback` in proxy/hosting access logs:
  the query contains a short-lived authorization code. Application error messages are sanitized.

## Verification

`PYTHONPATH=backend/src python -m unittest discover -s backend/src/tests -p 'test_*.py' -v`

Tests cover new/repeat login, email collision, explicit password-protected linking,
wrong-browser/state/expired flows, callback replay, provider errors, revoked linking
sessions, disabled config and token claim validation. Provider exchange is mocked in
flow tests; a real Google login requires the deployment's OAuth client configuration.
