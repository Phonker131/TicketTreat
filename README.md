# TicketTreat

**Event discovery, registration, loyalty and QR admission for Czech events — web + Telegram Mini App + bot.**

TicketTreat is an actively deployed, free-pilot event platform at [tickettreat.eu](https://tickettreat.eu). It uses one Next.js web/Mini App frontend, a production-facing FastAPI service, a separately secured legacy Bot API, a Telegram webhook bot and Railway PostgreSQL.

> **Launch status (24 October 2026):** production services are online and the free-event flow is deployed. Code-level CI, encrypted database backups, a successful isolated production-backup restore drill, and Telegram webhook delivery are in place. This **does not** certify a completed public pilot, payment processing, legal/GDPR readiness or live end-user acceptance. TicketTreat does not collect payments itself during the pilot.

## Features in the deployed pilot

| Users | Organizers / operations |
| --- | --- |
| Browse Czech events and event details, photos and galleries | Create, edit, publish/cancel events and manage media |
| Sign up, verify email and sign in through Google or Telegram Mini App | Owner-scoped event administration, admin MFA and staff check-in |
| Link website and Telegram identities; view and cancel tickets | Capacity controls, protected QR scans, attendee reporting and CSV |
| Book free tickets, enter waitlists, receive timed offers | Confirmation of externally paid reservations (no platform payments) |
| View attendance and per-organizer loyalty stamps (0/3/6/12) | Event notifications, reminders, support tickets and CMS updates |
| Add eligible passes to Apple Wallet; multilingual interface | Consent and privacy request workflows with pending operator details |

Loyalty queue priority for the 3-visit tier is active. Early access, VIP companion and other advanced benefits are **planned**, not activated. For externally paid reservations, any money is transferred directly to the organizer; TicketTreat has **no live card charging or refunds**.

## Architecture

| Railway service | Function | Code |
| --- | --- | --- |
| Frontend | Website and Telegram Mini App; HttpOnly session BFF | `frontend/` |
| TicketTreat API (previously `Demo API`) | Public production FastAPI for accounts, events, tickets, QR, waitlists, loyalty, support | `backend/src/` |
| Backend | Isolated legacy Bot API; requires private server-to-server key | `backend/src/` |
| Bot | Telegram notifications and commands, HTTPS webhook with Telegram secret header | `bot/src/` |
| Postgres | Production data, Railway private networking (no public TCP proxy) | `backend/src/db/` |
| Encrypted DB Backups | Twice-daily encrypted archive to a private AMS bucket | `ops/backup/`, `scripts/` |
| Pilot Health Monitor | 15-minute site/API health probes | Railway Function |
| Production Incident Alerts | Railway incident notifications to admin Telegram chats | Railway Function |

**Public API:** `/api/v1/*`, e.g. `GET /api/v1/health/ready`. Previously shipped `/demo/*` routes remain supported to prevent breakage of existing tickets, Mini Apps and clients. Never use `/demo/admin/*` to administer production: it is intentionally blocked. The website uses its same-origin `/api/gateway/api/v1/*` BFF with strict origin checks and HttpOnly cookies. The API service name in Railway may still show its former label until it is renamed in the dashboard.

### Local development

Use Python 3.12, Node 22 and an isolated PostgreSQL database (PostgreSQL 16+). Do **not** reuse Railway production credentials or bot tokens.

```sh
python -m pip install -r backend/src/requirements.txt
python -m uvicorn main:app --app-dir backend/src --host 127.0.0.1 --port 8000
```

Set `BACKEND_API_URL=http://127.0.0.1:8000` in `frontend/.env.local`, then:

```sh
cd frontend
npm install
npm run dev
```

Use [`.env.example`](.env.example) as the starting point for development-only variables. The bot is optional for local browser testing; to run it use `pip install -r bot/requirements.txt` and a **separate test Telegram bot**. Production uses `BOT_DELIVERY_MODE=webhook`, a public HTTPS webhook URL and a private Telegram webhook secret.

```sh
PYTHONPATH=backend/src python -m unittest discover -s backend/src/tests -p 'test_*.py' -v
cd frontend && npm run build
```

GitHub Actions additionally runs PostgreSQL integration, Chromium E2E, TypeScript and dependency-audit checks. Always evaluate the complete release gate before switching production branches.

## Deployment & safety

- Production Railway services use a single managed PostgreSQL; public DB TCP access is closed.
- Daily encrypted archives run at 03:00 and 15:00 UTC. A **real production backup** was successfully decrypted and restored into isolated PostgreSQL 18 on 24 October 2026; the temporary service was deleted.
- Incident alerts are delivered to admins through Telegram. A test alert `Deployment.failed — Railway service` at **10:18:33 UTC on 24 October 2026** was a deliberate webhook test, **not evidence of a failed application deployment**.
- The bot switched to a secret-authenticated webhook in production after recurring long-polling 409 conflicts. Test real commands and notifications before opening the pilot.
- Known follow-ups: isolated ongoing staging environment, external encryption-key escrow and cross-account backup copy, completed privacy/operator data, documented retention, and real-phone end-to-end/attendance trials.

See [current pilot release checklist](docs/UNIFIED_RELEASE_GATE.md), [Railway operations](docs/PRODUCTION_OPERATIONS.md), [engineering status](docs/FREE_PILOT_ENGINEERING_STATUS.md), [product roadmap](docs/PRODUCT_ROADMAP_TICKETTREAT.md) and [security audit](docs/SECURITY_AUDIT_2026-10-23.md).

## Git workflow

- `release/tickettreat-production`: canonical maintained production branch (see branch migration notes after source switch).
- `main`: historical baseline; it is **not** necessarily the latest Railway deployment.
- Legacy branch names are historical references only; production and new changes should use TicketTreat-branded branches. Retire old names only after verifying every Railway source and dependent pull request.

## License

Apache-2.0; see [LICENSE](LICENSE).
