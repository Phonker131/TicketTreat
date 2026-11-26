# TicketTreat — event check-in staff invitation and scanner access

**Review target:** release/tickettreat-production. New endpoints and protected backend code require @Phonker131 review. No production DB access, migration, or live email/Telegram send during development.

## Root cause

The existing POST /demo/manage/events/{event_id}/checkin-staff only inserted demo_event_checkin_staff and returned success. It never queued a notification, and ordinary participants had no visible scanner navigation. The scanner lived at /admin/check-in, although an authorized staff member does not hold an admin role. The browser camera stopped after each decoded QR until the operator manually restarted it.

## Proposed flow

1. Only an MFA-authorized event owner grants a **verified existing TicketTreat account** check-in rights for one event. Repeated concurrent grants are deduplicated by the existing event/account uniqueness constraint.
2. The same transaction queues a transactional Resend email and, when a verified Telegram identity is linked to the recipient account, a Telegram service message. Both contain an event title, date, entrance instructions, and the public **non-credential** scanner URL /admin/check-in?event=N. Neither carries QR ticket values, session credentials or participant details.
3. The recipient sees an event-scoped **Check-in access** card in their profile and can reach the scanner without organizer/admin privileges. The scanner lists only assigned or owned events and rejects QR values for any other selected event.
4. Organizers may use **Send instructions** for an already-granted account (including grants made before deployment). The service queues a new delivery for eligible channels at most three times per recipient/event/day. A notification is **queued**, not guaranteed delivered; absent providers are shown honestly. This is an explicit resend—no historic mass mailing.
5. The live frontend in companion PR #217 keeps the camera running between scans, suppresses the same QR for 15 seconds, and preserves the existing server-side atomic check-in lock. Camera failure retains manual entry and camera restart is available.
6. Removing access immediately revokes server-side check-in permission. Queued mail/Telegram instructions are skipped if the grant is gone, event is cancelled, account banned/unverified, recipient email changed or Telegram identity unlinked before worker delivery.

## Security model and limitations

- Staff receive **only** event check-in. No event management, attendee list, CSV export, account role, finance or global admin rights.
- Every scan rechecks the canonical web session, verified email and event ownership or explicit staff assignment. Ticket lookup (QR or enumerable printed `CRD` code) is restricted to the caller's authorized event IDs **in the SQL query before locking**. Unknown and foreign tickets produce the same `ticket_not_found` response; accounts without any event grant receive `event_checkin_access_denied` before ticket lookup. An optional selected event ID is checked only after an authorized ticket is found.
- Grant, resend, and scan routes use per-actor or per-event rate limits. API responses never claim provider delivery.
- Existing transactional email/Telegram outboxes provide durable retries, unique keys and worker locking; no new tables or migrations.
- Sending still requires actual configured Resend / Telegram credentials and successful provider delivery. A Telegram recipient must already have linked the correct verified TicketTreat account. Actual delivery, phone camera hardware, and operator UX must be rehearsed in staging on an iPhone/Android before production approval.
- Existing saved grants do not trigger retrospective email blasts. An owner can use the resend button for the person who missed the invite.
- Email can still arrive shortly before a simultaneous revoke completes; on opening the link the backend enforces the latest permission. An invite is **never** proof of access.

## Verification / release gate

- Unit tests: escaping, format and safe links, invalid notification keys.
- PostgreSQL integration: owner MFA, invite queueing and stable event scope, email/TG render, explicit resend, no staff export rights, foreign QR/printed-code existence indistinguishable from missing codes, wrong-event rejection before mutation, idempotent replay, revoke blocks scans and delayed invites.
- Frontend: TypeScript, Next.js build; Chromium registration/CSRF suite.
- Review with owner before merging to release. Do not mix this fix into the finance draft PR, and do not deploy it unreviewed.

## Rollback

No schema change. Revert code via a reviewed follow-up release. Any remaining checkin_staff outbox entries are safely skipped by older workers' unknown-kind handling. Already-sent instruction links do not grant capabilities and always rely on database assignment checks.
