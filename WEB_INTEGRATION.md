# TicketTreat: Web + Telegram integration (development)

This branch is an **unmerged, untested implementation**, not a production release. Existing bot handlers are retained. Never merge or deploy until the migration, local integration tests and a security review are completed.

## Architecture
- `frontend/`: React + TypeScript + Vite; one responsive codebase used in browsers and inside Telegram Mini App.
- `backend/src/web_api.py`: protected user-facing API under `/api/v1`.
- `backend/src/miniapp_auth.py`: signed Telegram launch validation, expiry enforcement.
- `bot/src/main.py`: legacy fallback commands, plus optional Web App launch button.
- Existing FastAPI routes for bot operations are guarded by `BOT_API_KEY` for all paths outside `/api/v1/*`, root and API docs.

## Required configuration
Shared:
- `DATABASE_URL`: PostgreSQL connection string.
- `BOT_TOKEN`: Telegram token used both in bot and backend.
- `BOT_API_KEY`: a long random secret that must match in bot and backend; **required** for legacy bot routes.
- `BACKEND_URL`: bot's internal API URL.
- `WEB_APP_URL`: optional public **HTTPS** URL of the frontend for the Telegram launch button.

Email verification on backend:
- `SMTP_HOST`, `SMTP_PORT` (defaults to 587), `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`.

Frontend:
- `VITE_API_URL`: empty for same-origin API reverse proxy (recommended); otherwise an API origin with correctly restricted CORS.

## Upgrade procedure
1. Back up PostgreSQL. Apply `backend/migrations/20261021_web_accounts.sql` to the existing database **before starting the updated backend**. The migration makes `users.telegram_id` nullable and upgrades it to BIGINT. Existing profiles and registrations are retained.
2. Set all shared and email variables in the environment. **Do not use the old credentials without updating BOT_API_KEY in both processes.**
3. Install Python requirements: `python -m pip install -r requirements.txt`.
4. Launch backend from repository root: `python -m uvicorn main:app --app-dir backend/src --host 127.0.0.1 --port 8000`.
5. In `frontend/`: `npm install`, `npm run dev`. Open `http://127.0.0.1:5173` for browser development. Vite proxies `/api` to FastAPI.
6. Start bot with `python bot/src/main.py`. For Telegram Mini App testing, expose frontend over **HTTPS**, set `WEB_APP_URL` to that trusted URL, and configure Telegram's Mini App entry point.
7. For public deployment, host frontend and `/api/v1` under one HTTPS origin or configure explicit CORS and strict trusted origins; do not expose backend debug/docs publicly without a security review.

## What has been implemented
- Public events catalog and event details.
- Email signup with SMTP verification code; email/password login and logout; session tokens.
- Telegram Mini App login using validated signed `initData`; optional Telegram link for a logged-in web account when launch data belongs to an unclaimed Telegram identity.
- Authenticated profile editing, personal events list, registration and cancellation with event-row locking on registration.
- Telegram bot Web App launch button and fallback commands; legacy API requests carry `BOT_API_KEY`.
- Profile/registration state shared between browser and Telegram for **linked** identities.

## Important limitations / release blockers
- **No completed end-to-end test** has been run with a PostgreSQL instance, SMTP server and Telegram. Build and runtime verification is still required.
- No password recovery, email address changing, account merge, comprehensive rate limiting, abuse protection, CSRF assessment for future cookie sessions, session management UI, or guaranteed email delivery.
- Linking an already existing Telegram profile to a separate email account deliberately returns 409 rather than merging accounts automatically. A verified account-merge workflow is required to preserve historical registrations.
- Legacy bot user-registration writes remain implemented as before. Consider reviewing all administrators' authorization decisions, broadcasts and database isolation before production.
- The current React interface has Russian text only; EN/CS/UK translations are still pending, even though the bot already supports them.
- Do not use the app as an actual ticket purchase/payment system: payment status is manual and not a payment gateway.
- User-scoped GET and POST APIs require bearer sessions; browser tokens are held in sessionStorage. Avoid third-party untrusted scripts and implement a CSP before launch.
- Use real database migrations rather than relying on SQLAlchemy `create_all` for subsequent schema changes.

## Manual acceptance checks
- Email signup sends a six-digit code, wrong code rejected and correct code creates a browser-only profile.
- Logging in with wrong password fails; accessing `/api/v1/me` without auth returns HTTP 401.
- Creating/editing a profile works; incomplete profile cannot register for an event.
- Registration blocks past, cancelled and full events; cancellation removes payment record.
- Telegram Mini App signed data logs into its own account, tampered data is rejected.
- Linking Telegram works only for an unclaimed Telegram identity and requires both active browser session and fresh signed launch data.
- Fallback bot commands work with matching BOT_API_KEY and fail without it.
- Existing Telegram user IDs, registrations, reminders and payment statuses survive migration.
