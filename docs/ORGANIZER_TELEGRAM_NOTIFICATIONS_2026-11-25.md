# Organizer Telegram activity notifications — 25 Nov 2026

## Scope

- An organizer who owns the event and has linked Telegram through a signed
  account-link flow can receive alerts on registrations, cancellations, waitlist
  joins/leaves/promotions and the first unread attendee chat message.
- The organizer dashboard includes `/admin/notifications` with per-category
  preferences (English and Czech). Owners without a linked Telegram account
  see the linking instructions; no Telegram ID can be supplied by a client.
- Global admins receive no participant activity for events they do not own.
  The legacy admin-security/support notification pipeline is unchanged.
- No retroactive notifications, marketing campaigns, QR tokens, invitation
  links, email addresses, phone numbers or chat bodies are sent to Telegram.
  Only event title, optional first name + surname initial, a change category,
  current registration count, and a link to authenticated management are sent.

## Delivery and failure handling

- Source operations write `tt_organizer_activity` and the existing
  `demo_telegram_notification_outbox` in the **same database transaction**.
  An activity's dedup key identifies the state transition; replays or repeated
  API requests do not fan out twice.
- The existing API notification worker sends the messages at a bounded rate,
  retries transient errors, and marks forbidden Telegram chats skipped.
- At delivery, both present event ownership and the signed Telegram link are
  rechecked, as are the recipient's organizer role, verified email, active ban,
  and current per-category preference. Revoked/unlinked/moved recipients are
  skipped even if a message was queued before the change.
- The normal organizer access gates (website session, MFA, role and email proof)
  protect the settings API. The message button links back to that same
  authenticated dashboard.
- A historical legacy bot-only registration may have no current linked website
  guest: its alert is generic, without a participant name.

## Migration / rollout

1. Obtain an approving review from `@Phonker131` for critical booking,
   auth/gateway, privacy and migration code.
2. Run unit tests, Postgres integration, TypeScript production build and
   browser checks in CI. Observe the database migration being applied
   idempotently in the disposable CI database before production rollout.
3. Verify encrypted backup freshness and ready status for production.
4. Deploy API first (database tables created automatically on startup or
   via `backend/migrations/apply.py`), then deploy frontend. The existing bot
   token and worker must remain configured; no additional Telegram token is
   needed. Do not send test notifications to real customer accounts.
5. Test using two owner-approved test accounts and an event with no real
   attendees: link the organizer's Telegram, register and cancel, check one
   outbox row per action, switch a preference off, and verify no send after
   unlink or ownership change.

## Recovery

- Forward recovery: disable all four preference flags for the impacted
  organizer, or temporarily stop the operational Telegram worker while the
  frontend/backend are corrected. Other queued service notifications also
  pause if the shared worker is stopped.
- Code rollback: redeploy the previous successful API/frontend commit. The
  two additive tables can safely remain in the database; the earlier build
  does not reference them. Do **not** drop the shared Telegram outbox.
- The migration only **adds** `tt_organizer_telegram_settings` and
  `tt_organizer_activity`. It neither rewrites guest tickets nor modifies
  existing role/session records. A database restore is not required for a
  normal rollback.
