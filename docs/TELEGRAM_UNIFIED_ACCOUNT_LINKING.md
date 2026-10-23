# TicketTreat — unified website / Google / Telegram identities

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
   Telegram WebApp.initData and the challenge to Demo API.
6. Demo API validates Telegram's HMAC, challenge status, expiration and
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
  runner; the Demo API's pre-deploy migration runs before app startup.
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
