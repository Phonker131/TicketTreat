# TicketTreat — Sprint 1: preparing, publishing and promoting events

**Status (2026-10-24):** Event publishing, previews, duplication and organizer management are implemented and deployed in TicketTreat production. This document describes the original Sprint 1 workflow, not a pending release. Check [engineering status](FREE_PILOT_ENGINEERING_STATUS.md) for outstanding acceptance tests.

## Organizer workflow

1. Open `/admin` with a verified organizer/global-admin account and TOTP MFA
   when operating in production mode.
2. **Create draft**: title, location and date, languages, capacity, price and
   available images. All new events created in the management dashboard are
   private by default.
3. Open `/admin/events/<id>/preview` for the **private** preview. This route
   reads the authenticated management API, not the public event endpoint.
4. Edit content before publication. A public event must have a title,
   description, venue, country, city, valid future start time, available
   capacity, at least one language, and a **zero** price. The publishing
   endpoint validates these on the server.
5. In the event dashboard choose **Publish now**, or set a future date/time
   and **Schedule**. Scheduled visibility is checked on every API request, so
   it does not depend on a background worker.
6. Copy an event to reuse its description, venue, poster, photo gallery and
   languages. The copy is always a draft, never reuses ticket registrations,
   waitlist records, scanned passes, or the original event ID. Edit its
   upcoming start time before publishing.
7. For a published event use **Copy link** or **Download QR for poster**.
   QR uses the actual current frontend origin, so it works on staging before
   the production domain is connected.
8. Guests can download an `.ics` calendar file or open the venue in Google
   Maps. The optional embedded map is loaded only after a click.
9. Published event pages have per-event Open Graph/Twitter metadata for
   previews in chat and social apps.

## Publishing invariants

- Existing historical events **without** a `demo_event_publications` row are
  considered published. This preserves legacy Telegram links and bookings.
- All newly created managed events explicitly get a `draft` row.
- Public event listing/detail, booking, waitlist, legacy registration, poster
  and gallery endpoints must not disclose or accept unpublished events.
  Management APIs remain protected by account role, ownership, session/MFA.
- A published event with active registrations or waiting attendees cannot be
  silently hidden as a draft. Use the audited cancellation workflow instead.
- The publication status never enables real-money checkout: paid event
  publishing is blocked until payment infrastructure and legal acceptance.
- Publisher and duplicate actions are logged in event moderation audit.

## Migration and test checklist

- Migration: `backend/migrations/20261022_sprint1_publication.sql`. Apply
  using the checksum-locked runner against isolated staging after verifying
  a backup/restore; never rewrite migrations already applied to production.
- Confirm private preview with organizer account and public 404 on a draft.
- Confirm draft booking returns 404 even for a verified attendee.
- Confirm publish and schedule status, including time crossing the deadline
  with no worker and a fresh backend process.
- Confirm duplicate does not inherit registrations or tickets.
- Confirm free booking, waitlist and QR check-in keep passing legacy E2E tests.
- Confirm calendar export/map and public QR and preview on a real HTTPS origin.
- Keep Railway Production deployment source unchanged until staging acceptance.
