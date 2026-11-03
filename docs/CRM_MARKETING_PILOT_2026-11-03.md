# TicketTreat CRM and marketing insights — pilot changes (3 Nov 2026)

## What ships in this PR

- Owner-scoped, aggregate CRM cohort metrics in the existing `/api/v1/manage/analytics/overview` response: unique checked-in visitors, one-visit attendees, repeat visitors (2+ visits), loyal visitors (3+ visits), visitors checked in within 30 days, visitors whose last check-in was over 90 days ago, and repeat-visitor rate.
- Channel performance by active QR tickets, including actual QR check-in totals, both across the organizer's selected events and per event. An operational check-in ratio is shown, **not** a click-through rate, total conversion rate, or payment metric.
- Creator-facing organizer dashboard panels for audience health, source breakdown, marketing links and prewritten public announcement copy. The campaign source can be a preset or a user-supplied `^[a-z0-9_-]{1,40}$` code; distinct source codes allow campaigns to be compared without a new database table.
- Public-event link generation uses the existing `utm_source` read by the event detail and checkout routes. Explicit tags now take precedence over the `telegram` fallback for signed Mini App checkouts; untagged Mini App registrations still record `telegram`.
- Existing read-only organizer authorization and MFA remain unchanged. No new endpoint, bulk messaging, export of PII, payment integration, scheduled job, or new migration.

## Important data definitions / limitations

All metrics are **within the latest 200 events accessible to the authenticated organizer** (global administrators use their existing cross-tenant administrative view). The underlying SQL groups by guest ID on the server and returns only aggregate counts, never guest identifiers, names, email addresses, phone numbers, or marketing contact lists.

Only active QR tickets contribute to source analytics and visitor cohorts. Legacy Telegram registrations, manually held paid reservations, and historical attendance outside the selected 200 events are excluded; hence this is not a total lifetime CRM. A visitor is a distinct guest with at least one confirmed QR check-in. Repeat means 2+ check-ins within the selected events; active means a last check-in in the past 30 days; inactive means the last check-in occurred over 90 days ago. An event may be in the future, so check-in rate is not a no-show rate.

`utm_source` values originate in public links; clients can forge or modify them. No first-party campaign tracking pixels, page views, ad spend, click data or verified attribution are implemented. Unique codes allow only comparisons of *active registrations and actual attendance*.

## GDPR / messaging boundary

Transactional notification and existing organizer event announcements remain separate from **marketing**. This PR **does not introduce segmented email, Telegram messaging, a mailing list, or an automatic marketing campaign sender**. An event registration or operational notification preference is not marketing consent. A future opt-in marketing module requires auditable purpose-, organizer- and channel-specific consent, withdrawal/unsubscribe links, retention limits and permission checks.

The marketing toolkit provides **copy-and-share** links and text that an organizer chooses to post on public channels. No user-specific contacts or identities are exposed.

## Verification before release merge

1. Run TypeScript production build and Next.js E2E on the PR branch.
2. Run CI PostgreSQL integration tests including `backend/src/tests/integration_organizer_analytics.py` on the disposable `tickettreat_ci` database. Confirm cross-organizer isolation, MFA, repeat cohorts, per-event source breakdown and absence of guest PII.
3. Verify the SQL aggregate query handles zero attendees and zero events and performs adequately for a representative 200-event organizer.
4. On staging with test accounts: generate a `utm_source=partner_nov` link, sign up from web and Telegram Mini App, complete check-in, and verify the code appears in both the global and per-event source report.
5. Test Czech and English labels on mobile and desktop, link copying, unpublish/cancel controls, disabled inputs and CSV export.
6. Retain current marketing-send restrictions. Verify that generating or copying an event link cannot send a message.

**Rollout:** This PR is intended for review against `release/tickettreat-production`. Do not merge blindly because that branch can affect production. Never use `dev/frontend-design` for the backend changes, and do not switch Railway branches for this PR.
