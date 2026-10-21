# Crowdly — Telegram Mini App integration (staging)

This branch deliberately remains separate from the Railway-deployed
`crowdly-demo-mvp-20261020` branch until build, database and bot tests pass.

## Current scope

- **Signed Telegram auth:** `POST /demo/telegram/auth` receives only
  `Telegram.WebApp.initData`, validates Telegram's HMAC-SHA256 signature and
  checks that `auth_date` is no older than 24 hours (future skew max 60s).
  `initDataUnsafe` must NEVER be used for API authentication.
- **Persistent Telegram guest:** new `demo_telegram_identities` table maps a
  verified Telegram user ID to a separate demo guest and their QR tickets.
  Existing bot users and paid/free registrations are not moved, overwritten
  or silently linked by email/username.
- **Existing bot registrations:** Mini App's *My tickets* displays past/current
  Telegram bot registrations alongside Mini App QR tickets, in separate sections.
  Legacy bot registrations remain legacy entries, NOT fake QR tickets.
- **Prevent accidental double booking:** if signed Telegram user has a bot
  registration for an event, Mini App blocks buying a second demo ticket.
- **Telegram bot confirmations:** after a new Mini App QR ticket is issued to a verified Telegram user, Demo API sends a best-effort private confirmation with a link to the QR pass (without exposing bearer tokens in the message). A blocked/not-started bot may not deliver the message.
- **Telegram bot entry points:** /app and /tickets, Mini App keyboard button,
  and existing WebAppInfo buttons on individual events.
- **Website email accounts remain separate.** They are never joined to a
  Telegram identity by unverified email or matching names. Explicit, verified
  linking is a later separate feature.

## Setup required at deployment

1. Keep PostgreSQL and the production Backend untouched; use the existing
   isolated *Demo API* service for new authentication/guest endpoints.
2. Configure `TELEGRAM_MINIAPP_BOT_TOKEN` ONLY on **Demo API** in Railway,
   using a secret reference to the existing **Bot** service's `BOT_TOKEN`.
   It must match the exact token of the bot that opens the Web App.
   NEVER commit the token or expose it in NEXT_PUBLIC_ variables.
   If no token is configured, /demo/telegram/auth returns HTTP 503 and
   explicitly refuses to authenticate.
3. Make sure `DEMO_ISOLATED_API=true` and `WEB_APP_URL` points to the
   HTTPS frontend. Keep `FRONTEND_ORIGINS` restricted to the frontend origin.
4. The existing Bot service must have the same `WEB_APP_URL`. It should
   deploy the updated bot/src/main.py only after the backend and frontend pass.
5. Configure BotFather's menu button Web App URL for the existing bot, using
   the same frontend HTTPS domain. Telegram requires a proper HTTPS Mini App URL.
6. If previously cached code exists in Telegram/iOS, close and reopen Mini App
   after release to refresh the signed initData.

## Acceptance tests

1. From Telegram (private chat), open /app. The verified Telegram profile
   should be shown; test that browser access without Telegram initData never
   acquires Telegram privileges.
2. From /start event_<ID>, open *Open in app*. The selected event loads
   on the same frontend, retaining language.
3. Open /tickets. Existing registrations through the old bot should appear
   separately from Mini App QR tickets. No extra QR should be generated.
4. Book an event not already registered for via the bot. A QR ticket should
   be issued for the signed Telegram guest and persist on reopening Mini App.
5. Try booking the same event through the old bot and then Mini App; the app
   should refuse a duplicate checkout with `already_registered_via_bot`.
6. Try a forged Telegram user ID / modified initData. Verify 401. Expired
   initData must also return 401; with no server token configured, return 503.
7. Verify existing web email login, participant/organizer permissions,
   old ticket links and Bot commands continue to work.
8. Confirm that fresh tests, Next.js build, Bot startup and DB migration
   succeed BEFORE merging; verify Railway logs and rollback plans.

### Local tests
```bash
cd backend/src
pip install -r requirements.txt
PYTHONPATH=. python -m unittest discover -s tests -p 'test_demo_telegram.py'
python -m py_compile main.py demo_telegram.py
cd ../../frontend
npm install
npm run build
```

## Limitations still needing design

The demo still uses browser-managed guest tokens; production should migrate
to safer HttpOnly sessions with strong CSRF protection and tighter API
authorization. Website email and Telegram identities are NOT automatically
linked; implement explicit dual-auth linking with user confirmation if needed.
Bot legacy registrations do not have Mini App QR codes and must not be
misrepresented as newly generated paid tickets.

Real money, organizer payouts and mass email delivery remain disabled for
the Mini App demo.
