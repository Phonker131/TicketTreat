# TicketTreat — Production security, resilience & performance audit

**Date:** 24 October 2026. **Scope:** technical operations only; legal/operator documents are deliberately excluded.  
**Evidence:** Railway production service inventory, deploy and HTTP logs, 24-hour resource metrics, bot/backup/monitor code, backend/frontend source and checked-in CI configuration. This is a targeted operational and source-level review, **not** a penetration test, load test, or certification.

## Production status and resilience

- 9 Railway services: frontend, main API, Telegram bot, isolated legacy backend, PostgreSQL, encrypted backup cron, health monitor, incident-alert function, email-forwarding function. At inspection: **0 critical issues, 1 warning on PostgreSQL, no current failed deployments**.
- PostgreSQL 18: private-network-only with **zero public TCP proxies**, persistent 5,000 MB volume. Last observed disk usage **0.2294 GB (~4.6% of provisioned size)**. The dashboard's single warning needs investigation in Railway; its precise reason was not exposed by the available inventory. Logs include SSL client disconnects during deployments; do not assume these explain the warning.
- Production uses **one instance** of the frontend, API, bot, legacy backend and PostgreSQL. Do **not** increase API replicas until the in-process reservation/offer and outbound-notification workers have a single-leader or separate worker service; otherwise background actions can run more than once.
- Private encrypted PostgreSQL backups are scheduled at **03:00 and 15:00 UTC**. Logs show a successfully verified AES-256-GCM archive on 24 October at 03:00 UTC (unencrypted temporary dump roughly 8.94 MB). The existing runbook records a successful restore into an isolated disposable PostgreSQL 18 database on 24 October. This validates recoverability of a tested archive, not every future backup.
- Disaster-recovery gaps: encrypted copies are within the same Railway organization; owner-controlled external escrow of the encryption key and a separately owned/provider-stored copy are still required. Do not hardcode, print or distribute keys in source, reports or chat. Backup retention should **not** be changed without an approved data-retention decision.

## Existing security controls observed

| Area | Evidence / state |
|---|---|
| Account/password protection | Argon2id password hashes, legacy rehash upgrade, random hashed sessions, PostgreSQL-backed auth rate buckets |
| Account and organizer permissions | Verified email, owner-scoped roles, MFA for privileged features, signed Telegram initData |
| API boundary | Same-origin BFF, strict origin checks on modifying calls, HttpOnly Secure SameSite session cookies, denial of legacy admin API |
| Ticket/booking integrity | Database row locks for capacity and QR check-in; deduplicated notification/outbox mechanisms |
| Abuse controls | Limits on login/recovery/support/organizer announcements; input constraints on event and support APIs |
| Telegram Bot | HTTPS webhook with secret-header validation; no competing long polling |
| Corporate email | Resend inbound webhook HMAC verification; replay/time-window protection and idempotent forwarding |
| Database exposure | No public TCP endpoint; internal server-side access only |
| Dependency and browser checks | Repository includes scheduled npm/Python dependency audit workflow and CI browser tests; their latest action-run outcomes were not independently inspected |

### Hardenings applied during this audit

1. Expanded the Railway **Pilot Health Monitor** from 3 probes to 6, adding public-health endpoints for the Telegram Bot, email-forwarding function and incident receiver. Existing homepage, primary API readiness, and private legacy backend probes remain. The monitor continues running every 15 minutes with bounded 8-second requests and a retry. The function deployment succeeded; individual six-probe cron-result validation must follow at the next scheduled execution.
2. Updated `frontend/app/api/gateway/[...path]/route.ts`: incoming non-GET request bodies are now read incrementally with a **6,000,000-byte hard cap**, early `Content-Length` rejection, and a **30-second** upstream API timeout. This closes the previous buffering-before-limits exhaustion risk while preserving current routes, auth and ticket behavior. Railway frontend deployment of the hardening commit later reached **SUCCESS**, and the service started successfully. The sampled HTTP requests after inspection did not show 5xx; full scenario regression still requires staging.

## Performance: production observation, not capacity benchmark

Sampled from latest returned **HTTP request log snapshots**, not a fixed randomized time series. These samples are not representative of 50,000 concurrent users.

| Service | Requests in snapshot | Successful 2xx | 4xx | Observed 5xx | Median request duration | 95th percentile | Maximum |
|---|---:|---:|---:|---:|---:|---:|---:|
| Frontend | 251 | 223 | 5 | 0 | 17 ms | 206 ms | 562 ms |
| TicketTreat API | 161 | 158 | 3 | 0 | 47 ms | 265 ms | 321 ms |

Frontend sample also includes 23 3xx responses. Highest observed frontend latency was linked to `/api/gateway/api/v1/telegram/auth` (about 505–562 ms), followed by `/api/gateway/api/v1/me/tickets` (about 357–364 ms). Main API observed slower calls include owner dashboard `/demo/manage/events` (about 244–316 ms) and password login (321 ms). **These are observations under light current load, not bottleneck attribution.**

24-hour resource metrics, approximate average / maximum usage:
- Frontend memory 0.125 / 0.370 GB
- TicketTreat API memory 0.119 / 0.276 GB
- Telegram Bot memory 0.042 / 0.106 GB
- PostgreSQL memory 0.103 / 0.193 GB; disk around 0.229 GB at observation
- CPU readings were low across all four; no sustained resource saturation apparent in sampled metrics.

## Required technical follow-up (priority-ordered)

### P0 before an unattended large-scale public launch
1. Diagnose the existing PostgreSQL warning in Railway UI, confirm volume alert thresholds, and check client SSL disconnect logs against deploy windows.
2. Establish external owner-controlled backup key escrow, a second independent backup location, and a periodic restore schedule. Never restore over production.
3. Create an **isolated staging environment** with a separate database, independent test bot token and mail disabled or sandboxed. Do not clone live production credentials or enable real emails in staging.
4. Run a **controlled staging** burst of registrations for the last available seat and simultaneous check-ins; assert no overselling, no duplicate QR check-in and correctly released offers/holds.
5. Confirm all six health probes complete successfully on the next cron run, and verify that failed scheduled jobs trigger a human notification, not merely a failed exit code.

### P1 capacity and reliability
6. Conduct load testing only on staging with agreed test budget: baseline 10 concurrent users, then 25, 50 and 100 with realistic event/detail/registration ratio. Track p50/p95/p99, throughput, errors, CPU, DB connections, locks and notification queue lag. Agree SLO and stop thresholds before testing. **Do not run saturation tests on the live single-replica database.**
7. Introduce separate single-leader background workers (expiry, email/Telegram queues) before horizontal scaling of the public API; then test multi-replica contention and backpressure.
8. Add performance alarms (sustained p95 latency, 5xx and slow DB queries), backup age alarms and owner-visible escalation. Assess edge WAF/bot filtering before public marketing campaigns.
9. Verify mobile device workflows with real participants including weak connectivity and staff QR fallback; user-reported working ticket synchronization is useful but does not replace check-in concurrency testing.
10. Review ongoing dependency audit outcomes and rotate secrets on a controlled schedule; no credential material should appear in CI artifacts or logs.

## Release interpretation

**Ready today:** ongoing production pilot with already-tested Telegram Mini App, bot ticket visibility, basic user features, verified encrypted backups, and technical alerts.  
**Not verified:** 50k-user capacity, sustained peak-load throughput, independent disaster recovery, full staging, periodic automatic backup-age paging, exhaustive pentest. Avoid advertising those as completed.

**Change trace:** production branch `release/tickettreat-production`; health monitor updated in Railway Function; gateway hardening in GitHub commit `0d215ff07b16a1b5258c15eab593a24c4ebb21dc`.
