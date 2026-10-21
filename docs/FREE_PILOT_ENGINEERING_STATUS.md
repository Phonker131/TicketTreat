# TicketTreat — Free Pilot engineering status (21 October 2026)

**Branch:** `feature/crowdly-release-preparation` (draft PR #5).
**Safety rule:** no production service source switching, migration, or database write
before an isolated restore rehearsal, secrets audit and explicit release approval.

## Implemented in code in this release branch

- Event preparation, draft/preview/publication/scheduling, duplication and public share QR.
- Website + signed Telegram identity, QR tickets, cancellation, waitlist auto-promotion
  and event-capacity row locking; paid purchases remain disabled.
- Verified website email login with a one-use, rate-limited 8-digit email OTP
  (existing verified accounts only); Google authorization-code sign-in separately.
  Login remains subject to existing MFA gates; no auto-grants.
- Configurable event booking cutoff (0–10080 minutes) enforced on website
  checkout and waitlist. The bot's legacy registration cutoff must be tested and
  aligned before deploying this setting to a mixed web/bot event.
- Configurable transactional reminders, with 7d/24h/3h presets. Only future
  scheduled reminders for verified ticket holders are queued; deduplicated
  by ticket ID, event start and lead time, with retry and suppression on edit.
- Rate-limited critical organizer email notices (access, logistics, schedule),
  only for verified active ticket holders. NOT a newsletter. Resend remains off
  until sender/domain verification and environment settings are complete.
- Scoped check-in staff delegation: granted by an event owner to an existing,
  independently verified account; limited to scanning that event. Separate
  owner-only manual admission, duplicate-scan warning and read-only live counters.
  Staff cannot export participants or manage event settings.
- Owner-only event insights: QR tickets, registrations including legacy count,
  check-ins, waiting, cancellations, fill %, daily booking data; attendee check-in
  history visible to the authenticated account only (up to 100 records).
- Organizer search/filter/sort, mobile analytics layout, existing public media,
  calendar, map, 4-language attendee interfaces and PWA support.

## Known engineering limitations — do NOT claim fully finished

- Waitlist currently **auto-promotes** eligible guests; a configurable
  offer/claim expiry workflow with cross-channel notifications is **not**
  implemented. Do not promise time-limited claims to participants.
- Registration is short for already authenticated browser/Google/Telegram
  users. Email OTP login supports *existing verified accounts*; brand-new users
  still need Google sign-up or account signup/verification. A truly registration-
  free 3-action first-time experience is not yet complete.
- Organizer/admin interface is not fully translated to CZ/EN/RU/UA.
- Uploaded gallery images are bounded but still stored in PostgreSQL;
  image order/crop/optimized object storage are not yet complete.
- No event end timestamp, so no-show metrics can only be interpreted as an
  indicative pending-admission count after start, not final attendance.
- No full venue acquisition-source analytics, per-device offline scanning or
  dynamic ticket lookups without connectivity.
- Legacy Telegram bots must be regression-tested against booking cutoffs,
  email and publication rules on isolated staging data.
- Operational notices are service announcements, not promotional newsletters.
  A consent, unsubscribe, preference and deliverability system is required
  before any marketing outreach.
- No real-money checkout, payouts, refunds or fee settlement.
- App scripts are not evidence of real encrypted offsite backups, actual
  storage lifecycle, 5xx alerts or disaster recovery.

## Release gate: staging before any production update

1. Isolate Railway staging with separate Postgres and **test** Bot credentials.
   An attempt to create `TicketTreat Staging` on 21 October was rejected by
   Railway with **"Deploys have been paused temporarily"**. It was not created.
2. Take a safe snapshot of the **live production** database; restore into
   staging without exposing user data to test email/Telegram providers.
3. Preflight old bot duplicate registrations and conflicting website/Telegram
   identities; do not apply the unique indexes to unreconciled data.
4. Apply versioned migrations using `python backend/migrations/apply.py`
   twice on staging; confirm idempotence and version ledger, test rollback.
5. Keep original Bot/Backend secret compatibility when switching branches.
   Provision matching `BOT_API_KEY` on both before changing the legacy service.
6. Verify app callback and SSL origins on `tickettreat.eu`, real Google OAuth,
   Telegram signed initData, BotFather menu and live Telegram devices.
7. Verify SPF/DKIM/DMARC and Resend, email confirmation, passwordless login,
   reminders, delivery retries, cancellation and failed-delivery alerts.
8. Perform mobile/tablet scan, multi-device duplicate checks, checkout,
   waitlist, cancellation, privacy export/erasure and moderation scenarios.
9. Configure daily encrypted offsite database backups with key escrow, storage
   rotation, an actual restore drill, health checks and on-call alerting.
10. Approve final privacy controller details, retention windows, processor
    agreements, public notices/terms, privacy contact and operator roles.
11. Verify exact CI SHA green, stage acceptance and rollback evidence,
    then obtain explicit authorization to switch **production** service sources.

## CI and testing

The repository includes `integration_pilot_ops.py` and
`integration_magic_login.py`, in addition to existing PostgreSQL,
authentication and browser integration tests. GitHub Actions jobs validate
Python, migrations, PostgreSQL, browser E2E and TypeScript build on each
branch update. Check the exact final commit's CI results before merging.

## TicketTreat brand cleanup and legacy compatibility

**Active public brand:** TicketTreat, domain `tickettreat.eu`. New app-only
identifiers are `X-TicketTreat-Client`, `tickettreat-auth-change`,
`tickettreat_web_auth`, `tickettreat_interface_language` and
`tickettreat-qr-reader`. Website authentication markers and language choice
are migrated from previous browser keys on first use without changing the
HttpOnly session cookie. Regression testing verifies migration.

**Compatibility exceptions only (not product branding):**
- Older `CROWDLY:TICKET:` QR payloads remain accepted during check-in,
  alongside the new `TICKETTREAT:TICKET:` prefix.
- Stored organizer value `Crowdly` and saved CMS copy are normalized to
  `TicketTreat` before display; historic database rows are not rewritten in
  production by this branch.
- The old `x-crowdly-client` gateway header may still be accepted for
  already-loaded frontend clients; new requests send `X-TicketTreat-Client`.
- Browser storage aliases beginning `crowdly_` are **read for migration and
  then deleted**, not written as the current application state.
- Resend's old internal `crowdly-` idempotency prefix is retained as a
  *non-customer-facing delivery compatibility key* to avoid double delivery
  of previously queued mail after a deployment. It is not part of the sender,
  subject, template or product name.
- `feature/crowdly-release-preparation` and
  `crowdly-demo-mvp-20261020` are historic branch identifiers linked to
  active release/production configuration. Rename those only as a separate
  source-migration operation, not as a cosmetic commit.

## Product milestone

Ship free events first with a deliberately bounded feature scope; scale
studio-level CRM, loyalty, marketing and paid bookings only after real pilot
evidence and legal/payment dependencies are cleared.
