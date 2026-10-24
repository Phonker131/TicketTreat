# TicketTreat: Czech pilot, participant sign-in and Apple Wallet

**Status (2026-10-24):** Website, Telegram bot, Google sign-in and ticket flows are deployed. This setup guide is retained for credential provisioning and regression testing; Apple Wallet pass signing requires valid certificates, and a feature's presence in code does not prove real-device acceptance.

## Pilot interface

Country/city questions are hidden from participant and organizer forms. New
profiles/events send `country_code=CZ`, `city=""`; the actual **venue address**
remains a separate, required event field. Legacy location data is not deleted
from the database. The header's Telegram button uses the existing
`NEXT_PUBLIC_BOT_USERNAME` frontend build variable; it must be the **bot's
username**, not the support contact.

## Google sign-in

The implementation exists but needs a real OAuth application with HTTPS:

1. Google Cloud → create a Web OAuth client for TicketTreat; enable the audience
   and add your pilot testers if in Testing mode.
2. Authorize the exact `https://tickettreat.eu/api/auth/google/callback`
   redirect if **that domain has working HTTPS and points to the frontend**.
3. Railway **TicketTreat API**: set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI`. Railway **Frontend**: set `GOOGLE_REDIRECT_URI`.
   Never use `NEXT_PUBLIC_` for the secret.
4. Run the repository's additive Google SQL migration and verify a real
   Google account on staging before public production use.
5. Existing email/password accounts **must explicitly link** their Google
   account after logging in. Matching emails alone must not transfer tickets
   or privileges. Accounts without passwords can recover one using verified
   mailbox ownership.

The alternate *sign in using an email code* entry point has been removed
from the profile UI, not the server or database (for compatibility).

## Transactional email

Railway TicketTreat API must have:
`EMAIL_NOTIFICATIONS_ENABLED=true`, `RESEND_API_KEY`, a domain-verified
`EMAIL_FROM`, and a strong 32+-character `AUTH_CODE_SECRET`.
Verify sender SPF/DKIM and ideally DMARC in Resend. Never expose secrets
to client-side Next.js environment variables.

The public `GET /demo/auth/email/status` reports only service configuration,
never whether a user account exists. A password reset response is deliberately
generic to prevent address enumeration. Password resets now work for existing
accounts that did not finish email verification: possession of the recovery
code verifies the address on completion. Provider send failures are logged
server-side; check Railway TicketTreat API logs and Resend delivery/bounce logs
without exposing codes.

Verification email code uses selectable, unspaced 8 digits and an email text
fallback. Web forms use `autocomplete="one-time-code"`; Apple/Android OS
autofill is best-effort, because the OS and email client control it.

## Apple Wallet

A Wallet pass is a **cryptographically signed** event ticket, not a QR PNG.

On Railway **Demo API** set these secret/service-only variables after obtaining
real Apple Developer Pass Type ID credentials:

- `APPLE_WALLET_PASS_TYPE_ID` — must match the certificate (e.g.
  `pass.eu.tickettreat.tickets`, but use your registered identifier).
- `APPLE_WALLET_TEAM_ID` — Team ID matching the certificate.
- `APPLE_WALLET_CERT_PEM` — PEM-encoded Pass Type certificate.
- `APPLE_WALLET_KEY_PEM` — matching unencrypted PEM private key.
- `APPLE_WALLET_WWDR_PEM` — Apple WWDR intermediate certificate.

Store keys only as **Railway service secrets**, never in GitHub,
frontend variables, issue comments, or chat. PEM line breaks may be
represented by literal newlines or escaped `\\n`.

`GET /demo/wallet/status` hides the button until these variables are
available. `GET /demo/me/tickets/{id}/wallet` checks the signed current
user/Telegram identity, verifies ticket ownership, rejects inactive passes
and serves `application/vnd.apple.pkpass`. Its QR code is identical to
the TicketTreat scanner format.

Download the pass on an iPhone running current iOS Safari and verify that
Wallet accepts its certificate, image assets, date/time and QR on a **real
test ticket**. Telegram in-app downloads depend on Telegram and device
handling of `.pkpass`; use Safari if its in-app browser cannot open the
file. Cancellations invalidate QR check-in server-side, but existing
Wallet passes are **not yet automatically pushed updates**; a Wallet
web-service registration and push update channel would be needed for that.

## Release gate

Run `PYTHONPATH=backend/src python -m unittest discover -s backend/src/tests -p 'test_*.py'`,
`cd frontend && npx tsc --noEmit && npm run build`, all PostgreSQL
integration tests, and real-device acceptance tests. Keep the active
feature PR draft and Railway Production unchanged until test/backup/rollback
requirements in `docs/UNIFIED_RELEASE_GATE.md` are met.
