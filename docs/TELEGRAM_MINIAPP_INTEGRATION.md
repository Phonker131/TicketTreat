# Crowdly — Telegram Mini App integration

A separate DRAFT pull request is used to protect the running Bot, original Backend and PostgreSQL.

## Implemented
- One Next.js PWA works in browser and Telegram Mini App.
- The bot adds Mini App entry in the keyboard, /app, /tickets and event-specific Open in app.
- Isolated Demo API validates signed Telegram WebApp.initData via HMAC-SHA256
  with the WebAppData key derivation; auth_date is checked against expiry.
- demo_telegram_identities maps a signed Telegram ID to a stable demo guest.
  No implicit merging with email/password accounts.
- Mini App shows its QR tickets alongside separate pre-existing bot registrations,
  without inventing legacy QR tickets.
- Duplicate registrations by the same Telegram identity across both surfaces are rejected.
- For zero-priced events, QR tickets are issued immediately without a payment screen;
  paid events still use demo simulation and charge no real money.
- Inside Telegram the signed identity takes priority over stored website sessions for
  booking and ticket retrieval. Website accounts remain separate.

## Private Railway configuration (NOT APPLIED)

1. Backend Demo API variable TELEGRAM_MINIAPP_BOT_TOKEN must be set privately
   to the same token that powers the Telegram Bot. Prefer a Railway variable
   reference to Bot.BOT_TOKEN when available.
2. Confirm Demo API DEMO_ISOLATED_API=true and retain existing DATABASE_URL.
3. Confirm frontend NEXT_PUBLIC_API_URL points to the Demo API.
4. Ensure API FRONTEND_ORIGINS allows the exact HTTPS frontend origin.
5. Set WEB_APP_URL on Bot to the existing HTTPS frontend base URL.
6. Deploy Demo API and Frontend first; validate using Telegram real initData.
   Deploy the updated Bot only after validation. No database wiping.
7. Optional: configure the BotFather menu button and Mini App launch URL.
8. Never put bot tokens into frontend NEXT_PUBLIC variables, chat or GitHub.

## Test scenarios
- /app opens Mini App; signed identity is accepted, forged data is rejected.
- /tickets shows QR tickets and separate earlier bot registrations.
- Reopening Mini App on another device retains Telegram-linked demo tickets.
- Duplicate booking via bot and Mini App is rejected.
- Free event issues QR without card details or money charges.
- Paid event remains explicitly demo-only, with no charges.
- Organizer can check in Mini App QR. Existing website login remains available.
- New CI build/tests pass; staged deployment does not affect running services.

## Not included
- Explicit Telegram-to-web-account linking (must verify BOTH sources).
- Migration of legacy bot reservations to QR tickets.
- Production real-money payments, outbound Telegram ticket notifications.
- Full HttpOnly cookie migration, passwordless login and hardened session storage.
