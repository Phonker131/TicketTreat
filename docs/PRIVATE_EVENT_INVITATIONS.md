# TicketTreat — invitation-only events (free pilot)

An organizer can create an event with **Public (catalog)** or **Private (invitation link)** visibility. Existing events remain public by default. New organizer events start as drafts in either mode; publishing/scheduling controls when booking opens.

## Organizer workflow

1. Open the organizer dashboard, select **New event** and choose **Private — invitation link only** in the visibility selector.
2. Fill in the event details, save as a draft and use the regular **Publish now** action when ready to accept bookings.
3. On the event's management page, use **Copy invitation link** to share a URL such as `https://tickettreat.eu/events/42?invite=<opaque-random-token>`.
4. Guests with the full link can open the event, log in/sign up and register. Anyone without a valid token gets an HTTP 404, even if they guessed the event's numeric ID. The event does not appear in the public event catalog, organizer public event lists or the dynamic sitemap. The event page carries `noindex` and `no-referrer`.
5. Toggle to **Public** only when intentionally making the event visible to everyone. Turning a public event private generates a **new** secret. Duplicating a private event creates an independent, private draft with a fresh token.

## Security boundaries and trade-offs

- This feature is **unlisted, link-based access**, not a password/guest whitelist. Anyone who obtains the invitation may forward it. An email-verified account or signed Telegram identity is **still required** to obtain a ticket; the invite does not authenticate a user.
- Invite tokens use `secrets.token_urlsafe(32)` (256 bits) and server-side constant-time validation. No invitation secret is included in general event listings, public organizer pages, sitemap or Event JSON-LD. The organizer-only management API returns the share link.
- An invite token is sent to the API in `X-Event-Invite` rather than appended to API URLs. The public share URL still contains a query token, so treat screenshots, pasted URLs, browser history and logs as sensitive. Frontend metadata sets `Referrer-Policy: no-referrer` for invite-only events.
- Published private poster/gallery responses require invite/owner credentials and use `Cache-Control: private, no-store`. Organizer preview still works with authenticated owner cookies.
- All booking methods — legacy bot registration, normal and signed-account checkout, free waitlist, waitlist claim and externally paid reservations — check private access server-side. Old QR tickets and event participants retain their existing ownership-scoped ticket views.
- Switch an event to public and back to private to **replace** a compromised invitation link. This revokes old invite tokens. (It briefly makes the event public, so use with care; a dedicated rotate endpoint could improve this later.)
- The token is stored in the database to let owners copy the same link again. Do not log it or include it in analytics, email support dumps or public data exports.

## Database / release

A new, non-destructive `demo_event_invites` table has one row per private event. Its absence means `public`. Migration: `backend/migrations/20261102_private_event_invites.sql`. Preserve existing applied migration history. The production Postgres service and existing encrypted backup worker remain in place.

**Deployment order for current Railway split-branch setup:** Deploy the backend from `release/tickettreat-production` first; confirm database table creation and API health. Only then fast-forward `dev/frontend-design` (Railway Frontend's source), so guests never see a UI that calls an API version without invitation support. Run the disposable PostgreSQL invite E2E regression and full Next.js checks first.

No platform payments or Apple Wallet functionality is introduced.
