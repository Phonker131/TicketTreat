# TicketTreat — pilot launch for organizers (Czechia)

**Release status:** prepared in draft PR #5; **not deployed to public production**.
The public domain, Google OAuth, verified Resend sender and staging migration/restore
must be accepted before hosting the first real event. The old Railway services
and their database must not be swapped without a rollback test.

## 1. Publish a free event

1. Sign in with your **verified** TicketTreat account.
2. If you are a global admin or an approved organizer, complete **TOTP MFA**
   in `/security/mfa` and open `/admin`.
3. Create an event with venue/city, date/time, capacity, detailed description,
   price **0 CZK** (or 0 EUR/USD), poster and languages.
4. Free signup issues a real QR admission ticket **without card payment**.
   Bookings enforce a per-event capacity; full events offer a waitlist.
   QR check-in is on `/admin/check-in`. Old QR codes remain supported.
5. Try enrollment, cancellation, waitlist promotion and re-entry checks on a
   staging database before distributing public links.

**No paid sales** until a licensed processor, settlement, webhooks and refunds
are integrated. Demo payment mode must remain disabled in production.

## 2. Manage landing pages and event content

- **Site-wide landing headline, subtitle and hero image:** `/admin/content`,
  global administrator only.
- **Create/edit/cancel events, export attendance CSV:** `/admin`.
- **Event descriptions, venue, cover photo:** edit the event.
- **Photos from previous editions:** add up to eight gallery images in the
  event editor, directly upload JPG/PNG/WebP (at most 2 MiB per image) or
  include external HTTPS photo links. Remove uploaded images in the editor.
  For the pilot, uploaded images are kept in PostgreSQL; move to
  dedicated object storage before operating a large gallery.
- **Event video:** YouTube/Vimeo HTTPS link displayed on the public event page.
  Direct large-video hosting/transcoding is not implemented.

## 3. Add a coequal global administrator

A user-provided email address **is not sufficient to grant access**.
The person must first create a TicketTreat account and **verify their email**.

1. The existing global admin signs in, completes MFA and opens
   `/admin/accounts`.
2. Enter the second person's **verified TicketTreat account email** in
   **Главные администраторы** and confirm the grant.
3. The new global admin configures and confirms TOTP MFA in
   `/security/mfa`; a prior login may need to be refreshed.
4. Check that both accounts can access `/admin/content`, `/admin/accounts`
   and all event management pages.
5. The grant/revocation is tied to the immutable account ID, separately
   recorded in the audit table, and can be revoked by another admin.
   No email-to-admin auto-grant exists.

Google-only accounts that do not yet have a usable password may need to
set one via the verified password-recovery flow before TOTP enrollment.

## 4. Participant emails and important reminders

- Only **verified website-account holders with active event tickets** qualify
  for operational reminders, event-date/venue changes and cancellation notices.
  The `/admin/events/{id}` dashboard shows the eligible count and status.
- Organizers may export event attendance CSV; it can include unverified or
  legacy guest contacts, **not a marketing opt-in list**.
- Ticket issue, 24-hour reminder, check-in, event move and event cancellation
  are supported by the durable PostgreSQL transactional outbox.
- Before enabling mail, validate `tickettreat.eu`, SPF/DKIM/DMARC and the
  Resend sender. Configure `RESEND_API_KEY`, `EMAIL_FROM`,
  `WEB_APP_URL`, and `EMAIL_NOTIFICATIONS_ENABLED=true` on the correct
  API service. Until configured, there are **no outgoing notices**.
  The backend does not retroactively blast messages from before enablement.
- Promotional newsletters require separate consent/opt-out and should not
  reuse the operational email function.

## 5. Database and deployment safety

1. Back up and prove you can restore a PostgreSQL copy to isolated staging.
2. Run the preflight: `python scripts/preflight_database.py`.
3. Apply migrations with `python backend/migrations/apply.py` against
   **staging** first, then retest after the migration ledger is updated.
   New additions are global-admin delegation, bounded gallery images,
   operational notices and an outbox notice reference.
4. Validate the CI matrix (Python, PostgreSQL, TypeScript and Chromium).
5. Confirm Google OAuth callback, email delivery and Telegram Mini App on
   the final HTTPS domain. Run a small volunteer pilot event before
   merging release PR #5 and switching Railway deploy sources.
