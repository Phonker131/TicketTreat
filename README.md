# TicketTreat / Crowdly

> **Status: Active development — work in progress.** Features, data models, and setup may change. This is not a final release.

A Telegram event registration project with a FastAPI backend and PostgreSQL storage. The repository is named TicketTreat; the current application identifies itself as Crowdly.

## Features implemented in the source
- Participant profiles and profile editing.
- Event browsing, registration, and participant limits.
- Administrator event creation, editing, cancellation, and broadcasts.
- Event reminders and manual payment confirmation.
- CZK, EUR, and USD event prices.
- English, Czech, Russian, and Ukrainian interface text.

Payment status tracking is manual; it is not a payment gateway integration.

## Stack
Python, FastAPI, SQLAlchemy, PostgreSQL, pyTelegramBotAPI, Pydantic, Requests.

## Architecture
The Telegram bot calls the backend over HTTP. The backend stores users, events, registrations, and supporting settings in PostgreSQL.

| Path | Purpose |
| --- | --- |
| `backend/src/main.py` | API, payment settings, and background processing |
| `backend/src/db/` | SQLAlchemy models and database sessions |
| `bot/src/main.py` | Telegram handlers, menus, and translations |
| `requirements.txt` | Root Python dependency list |

## Local setup
Use Python 3.11 or newer and a local PostgreSQL database.
```sh
git clone https://github.com/Phonker131/TicketTreat.git
cd TicketTreat
python -m venv .venv
```
Activate the environment with `.venv\Scripts\activate` on Windows or `source .venv/bin/activate` on macOS/Linux, then run:
```sh
python -m pip install -r requirements.txt
```

Create a PostgreSQL database and a local database user, then copy `.env.example` to `.env` in the repository root and fill in your values. Both processes load this file; existing shell environment variables take precedence.

Configuration:
| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL SQLAlchemy connection URL |
| `BOT_TOKEN` | Token for your own Telegram bot |
| `ADMIN_IDS` | Comma-separated numeric Telegram administrator IDs |
| `BACKEND_URL` | Backend URL; defaults to `http://127.0.0.1:8000` |
| `BOT_USERNAME` | Your bot username |
| `CLIENT_SERVICE_URL` | Optional support link |

Start the API from the repository root:
```sh
python -m uvicorn main:app --app-dir backend/src --host 127.0.0.1 --port 8000
```
Start the bot in a separate shell with the same virtual environment:
```sh
python bot/src/main.py
```
Explore API documentation at `http://127.0.0.1:8000/docs`.

## Current limitations
- The backend creates missing tables on startup; this does not migrate existing columns.
- Bot conversation state is stored in memory.
- Telegram/PostgreSQL end-to-end flows require your own local services and credentials.
- Automated checks currently cover Python syntax, not complete event-registration flows.
- Keep the API local during evaluation until authentication and authorization have been reviewed.

## Development priorities
- Add integration tests for registration limits, cancellations, and payment status changes.
- Introduce versioned database migrations.
- Split large handler modules as the feature set stabilizes.
- Review backend access control before a public deployment.

## Dependencies
The root `requirements.txt` is the dependency source of truth. Files under `backend/` and `bot/` forward to it so existing install commands remain usable.

## License
See [LICENSE](LICENSE).
