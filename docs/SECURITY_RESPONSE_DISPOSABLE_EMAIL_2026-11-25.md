# TicketTreat: unsolicited QA registrations — security response (25 Nov 2026)

## Scope and authorization

The owner explicitly authorized access suspension of the following two *exact*
production identities. Their account IDs and email addresses are matched
together before any data change:

- #42, `ttqa20261125@euploading.com`
- #43, `ttorg20261125@euploading.com`

Their support tickets, messages, guest records and tickets remain intact for
incident review. The one-time migration appends auditable `ban` actions with
system actor `0`, revokes active web sessions and rejects pending organizer
applications. It never deletes either web account. If the identifiers do not
match in an environment, the migration makes no account-specific changes.

The existing account-ban API is reversible. Ban/unban/history now require a
global administrator with a verified MFA session; self-bans and global-admin
bans are prohibited. A live ban is checked on each authenticated web, bot and
Mini App access path, not merely at session creation.

## Prevention

- New password, quick-OTP and Google-based *account creation* are checked
  against the local 10,455-domain CC0 list, including `euploading.com`.
- Domain comparisons are normalized and suffix-aware; substring lookalikes
  (e.g. `euploading.com.example.org`) are not blocked.
- Ordinary sign-in, account recovery and existing Google account login are not
  retroactively disabled by a future list update. Account bans remain a
  separate explicit action.
- Direct signup attempts per IP have been reduced from 40 to 20 per 10 min;
  quick OTP already limits requests to 12 per IP and four per email per hour.
- `SIGNUP_EMAIL_DOMAIN_BLOCKLIST_EXTRA` enables emergency additions without
  a new code release. `SIGNUP_EMAIL_DOMAIN_ALLOWLIST` lets operations correct
  specific false positives (exact domains only).
- When the static list cannot be read, account creation fails closed with a
  service-unavailable response; it never silently skips the check.

This is anti-abuse friction, not proof that every malicious sign-up is blocked.
Disposable domains can change, and automation can register real mailboxes.
Monitor 422 `disposable_email_not_allowed`, 429 limits and rejected organizer
applications, and refresh the domain snapshot periodically.

## Release / verification / recovery

1. Review the backend and UI PRs against their respective deployment branches.
   Require passing Python/security tests, PostgreSQL integration and frontend
   TypeScript/build checks; do not waive unrelated failures without a separate
   documented review.
2. Verify an encrypted production database backup and a restore rehearsal before
   applying production migrations. The latest confirmed encrypted backup during
   preparation was at `2026-11-24T15:04:47Z`; a post-incident backup and
   restoration drill were **not** verified at authoring time.
3. The API service uses the `python migrations/apply.py` predeploy command.
   The ban schema migration sorts before the one-time targeted suspension.
   Both changes use the checksum ledger and a transactional advisory lock.
4. After deploy, with a global-admin MFA session, read accounts #42/#43 and
   their `/ban-history`. Verify both latest actions are bans, organizer
   applications are no longer pending, and existing sessions cannot access
   protected routes. Verify normal `gmail.com` and `seznam.cz` signup/OTP flows
   and disposable-domain rejections using test accounts only.
5. If a suspension was a mistake, use the audited admin unban API. Do not edit
   or delete already-applied migration files. Session tokens remain revoked;
   the reinstated user must sign in again. To reverse a domain false positive,
   use the narrow allowlist or update the vendored list in a reviewed PR.

Never expose production DB credentials, personal traffic logs, session tokens,
OTP codes, or encryption keys in CI output or PR comments.

### Investigating future sign-ins

In the API service's Railway runtime logs, select the incident window in UTC.
Filter structured request records on the exact numeric account_id and
session_issued=true to find committed web-session issuance. The route template
distinguishes password, signup, email code and provider flows. Follow the same
account_id across subsequent requests and use request_id to identify one call.
guest_id identifies the resolved participant on personal ticket routes.
A missing identity means attribution was unavailable. An HTTP 200 on its own
does not identify the account, prove MFA elevation or prove disclosure.
