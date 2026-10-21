# Telegram Mini App integration

The **same Next.js application** supports normal browsers and Telegram Mini App. Telegram is an optional distribution and notification channel; the bot's commands remain a fallback.

## Authentication and account linking

- Browser users authenticate by email. Website sessions run through the Next.js gateway with an HttpOnly cookie.
- Mini App login sends the unmodified `Telegram.WebApp.initData` to FastAPI, which checks the signature, timestamp and Telegram ID.
- Website and Telegram identities are **not** inferred from matching names or email addresses.
- Account linking requires a logged-in, email-verified website account **and** fresh Telegram-signed launch data. Existing tickets and waitlist entries are moved only if there is no duplicate-event conflict. A conflict returns HTTP 409 for manual resolution.
- Old bot registrations remain separate from new website QR tickets; the app must not fabricate QR codes for legacy registrations.

## Bot and Mini App

The bot supports `/app`, `/tickets`, event deep links and existing commands. Ticket notifications use the same bot on a best-effort basis and may fail if a user has blocked it or never started a chat.

Mini App access requires an HTTPS website and the BotFather Web App/menu URL configured for the same frontend.

## Configuration

| Service | Variable | Purpose |
| --- | --- | --- |
| FastAPI | `TELEGRAM_MINIAPP_BOT_TOKEN` | Private secret matching the actual Telegram bot token |
| FastAPI | `DEMO_ISOLATED_API=true` | Maintain existing Bot/Backend deployment isolation |
| FastAPI | `DATABASE_URL` | Shared PostgreSQL source of truth for the web API |
| Next.js | `BACKEND_API_URL` | Server-only upstream API URL for the same-origin gateway |
| FastAPI + bot | `WEB_APP_URL` | HTTPS public URL of the frontend |
| FastAPI | `FRONTEND_ORIGINS` | Only trusted origins |

Never expose Telegram tokens through `NEXT_PUBLIC_*` or commit Railway secrets.

## Acceptance tests before release

1. Browser login works without Telegram installed.
2. Signed Telegram login is accepted and forged/expired `initData` is rejected.
3. A Telegram user can link an existing verified web account; duplicate-ticket conflicts cannot silently overwrite records.
4. Historical bot registrations are visible without being misrepresented as QR tickets.
5. Free event registration issues a valid QR pass; repeated registration cannot create a duplicate.
6. The bot can still handle `/start`, `/events` and other original commands after the change.
7. Cross-device ticket retrieval, check-in, notification failures and rollback work against a staging PostgreSQL copy.

See [release gates](UNIFIED_RELEASE_GATE.md). Successful source-level CI alone is not proof of an operational Telegram/Railway deployment.
