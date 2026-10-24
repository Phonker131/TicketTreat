# Telegram administrator UI — single source of truth

## Root cause (2026-10-24)

The original Bot native admin panel called legacy backend routes:
`GET /events/{event_id}/participants` and `GET /events`.
Those are not the production website's canonical authorized organizer endpoints. Website and Telegram Mini App use the TicketTreat API's `/demo/manage/*` (aka `/api/v1/manage/*`) with organizer-owned events, active QR tickets, payment holds and separate waitlists. Legacy participant lists omit website registrations and therefore incorrectly displayed an empty event.

The old panel also had alternate creation, update, cancellation, payment-confirmation, and direct-message broadcast flows. Continuing to maintain those would bypass the new publication model, MFA, email/Telegram notification queues and authorization model.

## Production fix

The bot's `⚙️ Admin` and `/admin` launch the **same** website management UI within Telegram WebApp (private chats) or HTTPS link (other chats). Available links:

- Events, editing, ownership, ticket participants, CSV: `/admin` and `/admin/events/{id}`
- Organizer performance / campaign link attribution: `/admin/analytics`
- QR checking: `/admin/check-in`
- Announcements: `/admin/broadcasts` (subject to existing site admin role and consent rules)
- Support tickets: `/admin/support`

All **old** `admin:*` and `broadcast:*` inline callback data are intercepted at `require_admin_callback`: handlers cannot execute outdated writes or read stale legacy participants, even when someone clicks an inline button from an earlier message. An old per-event callback opens the matching `/admin/events/{id}` page; old broadcast callbacks open `/admin/broadcasts`. Commands `/broadcast` and `/broadcast_photo` also navigate to the current management UI rather than sending a separate bulk Telegram broadcast.

Access rules:
1. Telegram admin **button availability** remains restricted to `ADMIN_IDS`; this configuration is a menu gate, **not** proof of account privileges on TicketTreat.
2. The website/Mini App separately requires a real signed-in organizer or global-admin account, verified email, currently sufficient MFA assurance, and per-event ownership.
3. A Telegram admin who is not signed in to that Telegram Mini App WebView must sign in there and complete MFA. A bot-side admin ID does **not** give automatic website admin rights.
4. Do not expose backend service secrets, session cookies, QR tokens or attendance exports through Telegram callback data.

## Manual smoke test

1. In a private chat with @TicketTreatBot, choose `⚙️ Admin`. Five HTTPS Web App actions should appear.
2. Choose dashboard; log in with an approved organizer account / complete MFA if required. Open an event whose ticket was registered through the **website**, check that the ticket appears in participants.
3. Compare the event's attendee count, pending payment holds, QR check-ins, waitlist and cancellations to the same page in a regular website browser.
4. Check the new analytics menu, check-in scanner, and global-admin-only broadcasts/support. Organizer accounts must not be able to read another owner's event or admin-only tools.
5. Tap an **old Telegram chat message** containing `👥 Participants` or `✅ Confirm payment`. It should now show a link to the canonical management page, and must NOT perform the old native mutation.
6. Confirm website registered participants receive the standard operational cancellation/announcement notifications through the existing outbox, not a separate bot mass-message loop.
7. Verify Bot Railway webhook status SUCCESS and no new HTTP 5xx in bot / API logs.

**Deliberate product choice:** a single rich responsive admin panel embedded inside Telegram instead of two divergent native implementations. There is no new copy of participant data.
