# TicketTreat — unified website / Google / Telegram identities

## Unified login (November 2026, pending production release)

This branch adds a safer default for all **new** TicketTreat participants:
**one canonical DemoGuest / ticket owner**, not two independent registrations.

- **Telegram bot/Mini App first:** signed Telegram initData creates the guest
  identity. Visiting the website later uses **Continue with Telegram** to
  authenticate the same Telegram user; the website session is normal HttpOnly,
  and the original QR tickets remain on the same guest ID.
- **Desktop login without BotFather OIDC keys:** the website opens a bot deep
  link with a random, one-use challenge. The original browser holds a separate
  HttpOnly verifier and shows a random six-digit PIN. Inside the signed Mini
  App, the user must enter that PIN and approve. A bot-link alone cannot log
  anyone in. The browser polls for signed approval and receives the session
  once, with 10-minute expiry and five PIN tries.
- **Official Telegram OIDC (optional):** when configured in BotFather, the
  website uses Authorization Code + PKCE, server-side state/verifier, RS256
  Telegram JWKS signature, audience/issuer/nonce validation, and a secure
  callback. This should supersede bot deep-link fallback when ready.
- **Email/Google-first:** if the user explicitly opts in while logging in
  inside Mini App, independently proven email/Google credentials and signed
  Telegram launch data are linked immediately. For **old two-account
  situations**, retain the existing challenge-based account-link button and
  preserve nontrivial paid/attendance merge conflict checks.
- **Email optional:** a Telegram-only participant has `email = NULL` until
  independently verifying a new unused address via one-time email code.
  Telegram-only logins cannot become organizers/global admins without
  the existing verified-email/MFA workflow.
- **Two users remain separate:** no automatic merges by contact email,
  display name, phone or username. A provider subject maps only to one
  canonical owner. Revocation invalidates sessions on a transferred shadow
  identity.

### Required deployment order and safety gate

1. Verify encrypted backup and **restore into an isolated database**. Review
   and apply the three new `20261110_*.sql` migrations through
   `backend/migrations/apply.py`, never edit applied checksums.
2. Deploy API + bot branch, validate `/demo/auth/telegram/browser/status`
   and existing signed Mini App `initData` against real device. Verify 2 users
   never see each other's QR passes.
3. Deploy frontend branch and test: Telegram-first desktop login and ticket
   ownership, new user check-in, two-provider login from Mini App, old
   challenge-based link, Google login, cookie/CSRF, iOS Safari/Telegram.
4. Official OIDC requires in BotFather > Login Widget the allowed URLs:
   `https://tickettreat.eu` and
   `https://tickettreat.eu/api/auth/telegram/callback`.
   Add private Railway vars **only** to API:
   `TELEGRAM_LOGIN_CLIENT_ID`, `TELEGRAM_LOGIN_CLIENT_SECRET`, and
   `TELEGRAM_LOGIN_REDIRECT_URI=https://tickettreat.eu/api/auth/telegram/callback`.
   Without them, fallback still works using the already-configured
   `TELEGRAM_MINIAPP_BOT_TOKEN`. Do not put OIDC secrets in the browser,
   repository or query strings.
5. Rollback: stop frontend Telegram sign-in, disable the new browser start
   endpoint by removing its bot token configuration only if the Mini App
   authorization consequence is understood (token used elsewhere), and roll
   backend/frontend code back as necessary. Keep additive migration tables
   and existing ticket rows; do **not** destructively revert account email
   nullability while Telegram-only accounts exist.

**Security constraints:** Consent and independently proven provider identities,
not matching names, authorize a merge. No unproven account can access another
person's tickets. The legacy manual-link UI remains available for previous
registrations.


**Deployment update (2026-10-24):** Website↔Telegram identity linking, organizer MFA step-up and Telegram HTTPS webhook delivery are in production. The canonical new API namespace is `/api/v1/*`; legacy `/demo/*` links are still accepted. Verify with a real linked account before public pilot.


**Goal:** A registered website user can attach the existing @TicketTreatBot
identity without creating another account, paying twice or losing bookings.
The site's verified web account remains the owner of email, password, Google
OAuth and roles; the Telegram identity points to that same canonical guest.

## User flow (ordinary browser, including Google sign-in)

1. Sign in to the website and verify the account's email.
2. On /profile choose **Connect through Telegram bot**.
3. Website starts an authenticated one-use challenge (10-minute TTL).
   Only SHA-256(challenge) is written to PostgreSQL.
4. The deep link opens @TicketTreatBot in a private conversation.
5. Tap **Confirm link** to open the Telegram Mini App. It sends signed
   Telegram WebApp.initData and the challenge to the production TicketTreat API.
6. TicketTreat API validates Telegram's HMAC, challenge status, expiration and
   canonical account verification, then moves non-conflicting bookings
   and marks the challenge consumed inside the same transaction.
7. The original browser checks the link status and reloads the account.
   Both interfaces now reference the same guest ID.

**No linking by email, first name, phone, username or unsigned Telegram ID.**
The deep-link code is a bearer capability: do not forward it. The bot never
receives the website bearer session or Google tokens.

## Data reconciliation

- Canonical website QR tickets take precedence when both identities have
  the same active *free* ticket, and the old free pass is marked cancelled
  in place for audit. No duplicate QR ticket is issued.
- Active paid or checked-in ticket conflicts, nontrivial waitlist collisions
  and multiple paid holds on one event are rejected with HTTP 409 for human
  review; nothing is overwritten.
- Unambiguous tickets, waitlists and organizer-confirmed paid applications
  are reassigned to the canonical guest.
- Old bot registrations are preserved. Existing reconciliation upgrades
  eligible free upcoming registrations, not old paid ones.
- The Telegram-only guest bearer credential is rotated, never returned to
  the browser. Original legacy bot data remains auditable.

## Bot / website feature boundaries

Events, publication state, capacity, waitlist, checkout, QR entry, gallery,
profile, support and organizer functions are served by the unified Mini App.
The bot keeps /start, /app, /tickets, /myevents, /events, /profile, /link,
 /support and /help as entry points; outdated registration callback
buttons route to canonical checkout instead of creating a second booking.
The old bot's legacy records are deliberately not bulk deleted.

## Release checklist

- Apply `20261031_telegram_browser_link.sql` once via the versioned migration
  runner; the TicketTreat API's pre-deploy migration runs before app startup.
- Verify a production PostgreSQL backup and restore procedure before merge.
- CI: Python syntax/unit, PostgreSQL integration including replay/collision,
  Next.js typecheck/build, Chromium e2e and SQL migration checksum.
- Device acceptance: browser Google login -> profile link -> bot private chat ->
  signed Mini App confirmation -> browser updates -> ticket visible in both.
- Test a pre-existing Telegram user with a free event and an existing website
  pass. Verify only one active QR pass remains.
- Test bot notifications, signed auth inside Android/iOS Telegram and a
  cancelled ticket not reappearing in My events.
- Bot service must have exactly one live polling instance. HTTP 409
  `terminated by other getUpdates request` indicates a second Telegram
  poller (possibly an operator's local script); it is **not fixed** by this
  identity-linking change.
- Confirm `WEB_APP_URL` is HTTPS and `TELEGRAM_MINIAPP_BOT_TOKEN` refers to
  the same @TicketTreatBot token as the bot service. Never commit tokens.

## Current limitations

- This links identities; it does not introduce anonymous desktop login using
  Telegram credentials. Browser login continues through email / Google.
- Conflicting paid bookings and complex queue offers require manual review.
- Bot direct messaging still requires the user to have started the bot and
  not blocked notifications.
