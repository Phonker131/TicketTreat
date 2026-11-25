# TicketTreat — banned-account side-channel hardening (25 November 2026)

## Incident and threat model

Two unsolicited automated-test accounts were banned after attempting role and
administrative endpoint probes. Their known tickets were cancelled by the event
organizer, and the organizer separately removed the remaining waitlist entry.
These are incident-containment actions; they do not replace authorization
checks for future bans.

The follow-up code audit found three ways an *already banned* canonical guest
could potentially retain some access without using an active website session:

1. **Unattended waitlist allocation:** the queue selector considered previously
   waiting entries without checking current account bans. Automatic promotion
   could issue a new active QR ticket, and timed offers could reserve a seat.
2. **Telegram event chat:** verified Mini App `initData` resolved a guest but
   did not apply the same ban policy as website sessions. This required a
   previously linked Telegram identity; no such link was established for the
   incident accounts in the available evidence.
3. **Ticket admission:** all four ticket-scanning/check-in paths validated the
   QR or ticket status but did not independently check whether its owner was
   banned. This matters for other active tickets not manually cancelled, or
   tickets issued by legacy/background code.

This is not evidence of any successful cross-account read or administrator
compromise. The HTTP audit found role/admin probes rejected by authorization,
and unauthenticated guest-private endpoints denied access. The available proxy
logs cannot attribute every successful login to a canonical account, so they
cannot establish absolute absence of account takeover.

## Patch design

- `priority_waitlist_entry` excludes banned canonical guest IDs in a single
  batched lookup before FIFO/loyalty sorting. **Existing queue rows remain as
  historical evidence**; the organizer can separately cancel them. Both
  automatic promotion and timed offers reuse this selector.
- `demo_event_chat.verified_guest` enforces the guest ban after either verified
  Telegram identity or website-session resolution.
- The legacy-admin, event-owner, and delegated-staff check-in paths enforce the
  same ban before allowing admission. Other guests' QR behavior is unchanged.
- No schema or data migration. No payments, previously issued QR values or
  historical registration records are edited by this code change.

## Verification and deployment checklist

1. Run unit tests, including `test_account_bans`, and the disposable-Postgres
   integration tests (`integration_ban_side_channels`) for:
   - banned guest preceding a legitimate guest on an auto-promoted waitlist;
   - banned guest preceding a legitimate guest on a timed-offer waitlist;
   - signed Telegram Mini App access to private event chat;
   - legacy-admin, organizer QR, printed ticket code, and organizer manual
     check-in attempts with a banned ticket owner.
2. Require `@Phonker131` owner review of the security-critical source files and
   the normal Python, PostgreSQL and frontend CI checks.
3. Deploy only the reviewed release-branch merge. Verify a terminal Railway
   `SUCCESS` for TicketTreat API, inspect boot/migration logs, and repeat
   unauthenticated guest/API isolation smoke checks. Do not test against real
   guest sessions or create production tickets as a probe.
4. Confirm both incident accounts remain banned, no active entries remain in
   their relevant event waitlists, and no other active tickets were issued to
   them. This last check requires authenticated production database/admin audit
   access and was not proven by this source change alone.

## Rollback and residual risk

If the deployment introduces an unforeseen regression, revert this PR via a
reviewed follow-up release and redeploy the last successful API revision; no
database rollback is required. Because the patch adds authorization denies,
verify legitimate, unbanned Telegram chat and waiting-list promotion in CI
before the owner merges it.

The patch closes the identified ban-bypass paths, but it is not a claim of
100% security: a full production session/account audit, independent penetration
test and ongoing monitoring remain separate work.
