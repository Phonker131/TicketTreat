# Telegram Mini App integration plan

Status: first safe foundation; **not production-ready**.

## What is included
- `miniapp/index.html`: read-only Telegram-themed events list using existing `GET /events`. It must be served behind the **same HTTPS origin as the API** (or via a same-origin reverse proxy). Launch from Telegram for native theme.
- `backend/src/miniapp_auth.py`: pure-Python HMAC-SHA256 verification for raw Telegram `initData`, with expiry, user ID checks, and duplicate key rejection. **It is not yet connected to the FastAPI app.**
- `tests/test_miniapp_auth.py`: standalone unit tests.

## Next integration steps
1. Add a dedicated `/miniapp/*` FastAPI router. Validate raw Telegram `initData` in the `Authorization: tma <raw-init-data>` header for every user-scoped request, and derive the Telegram user ID from validated data only. Return HTTP 401 for invalid/expired data.
2. Create `GET /miniapp/me`, `PUT /miniapp/me`, `GET /miniapp/me/events`, `POST /miniapp/events/{id}/register`, and `DELETE /miniapp/events/{id}/register`. Delegate to the existing business logic or extract shared services; never trust a client-supplied user ID.
3. Add safe public event detail endpoints, registration capacity conflict handling and error HTTP status codes. Ensure transactions are atomic for capacity checks.
4. Connect the profile, my events, event details, payment status, and cancellation screens; add EN/CS/RU/UK i18n.
5. Add a WebApp button to the Telegram bot, gated by `MINIAPP_URL`, and preserve the old menu while Mini App remains in development. Use HTTPS for Telegram launch. Configure the URL in BotFather as appropriate.
6. Review existing unauthenticated backend routes before making the backend public: the current legacy `/profile/{telegram_id}`, event-registration and admin routes must not remain freely accessible from the internet. Preserve bot access via a separate server-to-server credential, then migrate or guard legacy routes.
7. Run PostgreSQL integration tests and Telegram end-to-end tests, then enable Railway deployment separately.

## Local development
Use the repository's existing local setup to run PostgreSQL, FastAPI and the Telegram bot. Serve `miniapp/index.html` via the same origin as the API (a local static-file mount or development reverse proxy). Telegram tests need an HTTPS URL; a local tunnel is fine for development if access is secured.

**Important:** Do not merge this branch as a finished production Mini App. The catalog is intentionally read-only until authenticated API routes and legacy endpoint authorization are completed.
