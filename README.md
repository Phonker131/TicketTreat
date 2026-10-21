# TicketTreat

**Event discovery, registration and ticketing — on the web and inside Telegram.**

TicketTreat is a multi-interface event platform. A responsive Next.js website also runs as a Telegram Mini App; a Telegram bot provides notifications and fallback commands. Both use a FastAPI backend and PostgreSQL.

[![CI](https://github.com/Phonker131/TicketTreat/actions/workflows/ci.yml/badge.svg?branch=feature%2Fcrowdly-release-preparation)](https://github.com/Phonker131/TicketTreat/actions/workflows/ci.yml)

> **Release status:** under active development. Free-event registration and QR flows are implemented and covered by automated tests. Real payments and several production security/privacy requirements are not yet finished. **Do not use this branch to sell paid tickets.**

## Capabilities

- **Attendees:** browse events, select a city, register, access and cancel QR tickets, join waitlists, and manage a profile.
- **Accounts:** email login, verification and recovery; signed Telegram Mini App authentication; explicit account linking and session management.
- **Organizers:** create and edit events, set capacity and location, add photo/video links, review participants and check in QR tickets.
- **Global administrators:** manage account permissions and homepage content.
- **Notifications:** Telegram confirmations and an optional transactional-email queue with event reminders.
- **Languages:** English, Czech, Ukrainian and Russian in key interfaces; some administrative and editorial content still needs full localization.

## Technology

| Component | Stack | Location |
| --- | --- | --- |
| Website / PWA / Mini App | Next.js 15, React 19, TypeScript | [`frontend/`](frontend/) |
| API and business logic | FastAPI, SQLAlchemy, Pydantic | [`backend/src/`](backend/src/) |
| Persistent storage | PostgreSQL | [`backend/src/db/`](backend/src/db/) |
| Telegram bot | Python, pyTelegramBotAPI | [`bot/src/`](bot/src/) |
| Verification and CI | Python unit + PostgreSQL integration tests, Next.js build | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

The web app and Mini App share one frontend; Telegram adds its native launch and signed identity flow. Browser account sessions use a same-origin Next.js API gateway with an HttpOnly cookie. Bot commands remain available independently.

## Local development

Prerequisites: **Python 3.12**, **Node.js 22**, and **PostgreSQL 16** (or compatible versions).

1. Clone the repository and create a PostgreSQL database.
2. Copy [`.env.example`](.env.example) to `.env` and configure your **development-only** credentials. Never commit secrets.
3. Install and run the backend:

   ```bash
   python -m pip install -r backend/src/requirements.txt
   python -m uvicorn main:app --app-dir backend/src --host 127.0.0.1 --port 8000
   ```

4. In a separate terminal, configure `frontend/.env.local` with `BACKEND_API_URL=http://127.0.0.1:8000`, then start the web application:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. The bot is optional for browser-only development. To run it, install `bot/src/requirements.txt`, configure a **test bot token**, and start `python bot/src/main.py` from the repository root.

The website is available at `http://localhost:3000`; FastAPI documentation is at `http://127.0.0.1:8000/docs` in local development. Telegram Mini App testing requires an HTTPS URL and BotFather configuration.

## Testing and deployment

GitHub Actions runs frontend checks, backend unit tests and PostgreSQL-backed integration tests. For local checks:

```bash
python -m unittest discover -s backend/src/tests -p 'test_*.py' -v
cd frontend && npm run build
```

**Before production:** complete the staging database migration and restore rehearsal; configure trusted origins, backend URL, email sender, secrets and HTTPS; verify Telegram linking, bot compatibility and end-to-end flows. Paid ticketing requires a genuine payment provider, validated webhooks and refund handling. See [release checklist](docs/UNIFIED_RELEASE_GATE.md) and [Mini App guide](docs/TELEGRAM_MINIAPP_INTEGRATION.md).

## Development workflow

- `main`: current deployment baseline; not changed by experimental features.
- `feature/crowdly-release-preparation`: single active integration branch and [release PR #5](https://github.com/Phonker131/TicketTreat/pull/5).
- Keep each change reviewable as a commit; verify CI and staging before merging or deploying.

## License

Licensed under [Apache License 2.0](LICENSE).
