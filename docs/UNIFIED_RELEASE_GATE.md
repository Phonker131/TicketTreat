# TicketTreat — technical release gate (24 October 2026)

**Production exists and serves real users.** This is a gate for the **first controlled free-event pilot**, not an assertion that production was never deployed.

## Current production readiness

| Gate | Status | Evidence / limit |
| --- | --- | --- |
| Website, Bot, API, PostgreSQL | Deployed | Railway services Online / SUCCESS on 24 October |
| Free bookings and protected QR | Implemented and CI-tested | Real-phone acceptance not yet confirmed |
| Cross-device account linking | Implemented | Google + Telegram linking needs final real-account smoke test |
| Event notifications | Resend domain verified and recent messages delivered; Telegram webhook online | Trigger cancellations and reminders with test accounts |
| Waitlist/paid-reservation expiry | Workers enabled on only one API replica | Simulate expiry and capacity release |
| Per-studio loyalty | 3-visit waitlist priority is operational | VIP companion/early booking are planned |
| Encrypted offsite backup | Twice daily in private Railway AMS bucket | Separate key escrow and retention not confirmed |
| Disaster restore test | **Done** 24 October 2026 | Actual private archive restored into disposable PostgreSQL 18 and queried |
| Monitoring | 15-minute API probes, incident Telegram alerts | Test-only `Deployment.failed` message at 10:18:33 UTC was not production outage |
| Database external access | Closed | Railway public TCP proxy inventory empty |
| Legal operator and privacy fields | **Pending** | Joint-controller/contract review is a separate nontechnical workstream |
| Isolated ongoing staging | **Pending** | Ephemeral restore-test container is not a general staging environment |
| Real attendee pilot | **Pending** | Must exercise real signup → ticket → QR on phones |

## Required before public attendance

- [ ] Publish operator/controller identity and final privacy/cookie/retention disclosures after approval; do not treat a draft notice as legally final.
- [ ] Complete staging/real device regressions for login, email, Telegram, check-in, cancellation, duplicate QR and near-capacity booking.
- [ ] Validate at least one actual Bot webhook update and message delivery with a pilot account after the polling-to-webhook change.
- [ ] Observe expiry workers completing a simulated waitlist or external payment confirmation cycle.
- [ ] Put backup encryption key into independent secured company custody; test that the operators can use it after Railway loss.
- [ ] Give entrance staff a QR fallback plan and schedule a 10–20-person volunteer rehearsal.

Do not launch **TicketTreat platform-operated payments** during the free pilot. Paid reservation status records can model *organizer-confirmed external payments*; money flows are not processed by TicketTreat.

## Production API boundary

Versioned paths: `GET /api/v1/health/live`, `GET /api/v1/health/ready`, `/api/v1/auth/*`, `/api/v1/me/*`, `/api/v1/manage/*`. Website BFF: `/api/gateway/api/v1/*`. Old `/demo/*` remains compatible while clients migrate; do not remove production authorization, MFA or bot interface isolation in the rename.

Keep public web API and private legacy Bot Backend as separate Railway services. Use a high-entropy `BOT_API_KEY` for legacy private commands, `BOT_WEBHOOK_SECRET` for external Telegram webhook updates and private DB networking. Avoid placing token secrets in repository docs.

**Source of truth:** [engineering status](FREE_PILOT_ENGINEERING_STATUS.md), [Railway runbook](PRODUCTION_OPERATIONS.md), [product roadmap](PRODUCT_ROADMAP_TICKETTREAT.md).
