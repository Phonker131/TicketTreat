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


## Product direction: Web-first, Telegram-enhanced

The same responsive website must work as:
- a standalone, public website in any modern browser, without requiring Telegram;
- a Telegram Mini App embedded in Telegram, with Telegram-native theme and login;
- a shared system with the existing Telegram bot as notification channel and fallback command interface.

**Do not build two separate frontends.** Replace the early static HTML preview with a single React + TypeScript + Vite application. Use an environment adapter for Telegram WebApp SDK calls; the plain web browser must not assume `window.Telegram` exists. On web, offer email-based authentication plus optional verified Telegram account linking. In Telegram, securely validate `initData` on the backend; never trust `initDataUnsafe` as proof of identity.

### Identity model
- Give each person an internal immutable database user ID independent of Telegram.
- Associate optional verified identities: email and Telegram ID. Uniqueness constraints apply to verified identities.
- Email signup/signin requires verified email and a secure login flow; account linking requires proof of ownership of **both** accounts.
- Migrate legacy Telegram-ID-centric profiles and registrations while preserving existing associations; add an Alembic migration, not a destructive table recreation.
- Use secure sessions/tokens scoped to authenticated users and separate server-to-server credentials for the bot.
- Public event discovery can be anonymous. Profile edits, registrations and payment details require authentication.

### Feature parity
Both website and Mini App: public event catalog/details, account/profile, event signup/unsubscribe, my events, payment instructions/status, four interface languages, and responsive views.
Telegram bot: deep links to individual event pages, alerts for event updates, confirmations/reminders, and legacy commands as fallback. Never depend on a user's bot chat for core website functionality. Provide email or in-site notifications when Telegram is not connected.

### Proposed workspace structure
```
frontend/
  src/
    app/
    pages/
    components/
    features/
    api/
    auth/
    integrations/telegram/
    i18n/
backend/src/
  miniapp_auth.py
  # existing API and models; introduce protected routes and migrations
bot/src/
  main.py
```

### Delivery order
1. Implement shared responsive React frontend with anonymous event discovery, running directly in a browser; reuse the public events API.
2. Secure old API endpoints before exposure and add unified user identities, authentication, account-linking, and migrations.
3. Implement profile, event registration, personal event list, cancellation, and payments through protected shared API endpoints.
4. Add Telegram environment adapter and Mini App signed login while preserving full website functionality.
5. Add bot links, optional Telegram notifications and fallback commands; test changes locally with PostgreSQL and an HTTPS dev tunnel.
6. Deploy web frontend/API separately as needed, behind HTTPS, and configure public domain and Telegram web-app entry point.

**Current implementation note:** `miniapp/index.html` is a read-only proof of concept and not the definitive frontend. Existing API and bot are unchanged on this branch. Do not enable public backend access until the authorization review has been completed.
