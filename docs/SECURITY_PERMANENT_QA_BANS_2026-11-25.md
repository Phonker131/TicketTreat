# Permanent denial for two unsolicited QA accounts — 2026-11-25

## Scope and authorization

The TicketTreat owner requested a **permanent**, not merely indefinite and
admin-reversible, ban for the two previously investigated accounts. The
incident migration's system-authored suspension records identify them without
re-publishing their account IDs or email addresses in this change.

An earlier migration had already recorded normal bans, revoked their web
sessions and rejected their pending organizer applications. Their known tickets
were cancelled, and their event-16 waitlist entry was separately removed.

## Enforcement

New forward-only migration `20261125_permanent_qa_bans.sql` creates a separate
permanent-ban ledger, and inserts entries **only for accounts whose prior
owner-authorized, system-recorded suspension matches the incident marker**.
The prior migration already verified the exact account ID/email pairs; those
identifiers are intentionally not repeated in this commit. It also deletes any sessions remaining for these
targets. No other accounts or messages are modified. The data is retained for
incident investigation rather than being silently deleted.

Runtime access checks prefer permanent bans over the normal latest ban/unban
action. Therefore the web login/session path, OAuth/Telegram identity paths,
organizer chat, ticket QR admission and unattended waitlist allocation continue
rejecting the banned canonical accounts. The ordinary MFA-protected admin
`DELETE /demo/manage/accounts/{id}/ban` endpoint returns 403
`account_permanently_banned`; normal bans are still reversible. The accounts
list and audit history explicitly surface the permanent status.

## Release verification

1. Run unit, PostgreSQL integration, browser and production build CI checks.
2. Review this migration and its prior-incident audit proof with the owner.
3. Merge into `release/tickettreat-production`; do not apply SQL manually.
4. Confirm `Backend` and `TicketTreat API` deployments reach Railway `SUCCESS`
   and logs report `20261125_permanent_qa_bans.sql` applied.
5. In an authorized **read-only** production DB check, confirm both intended
   account IDs are present in `demo_permanent_account_bans`. Never use
   the disposable integration tests on production data.

## Limits and rollback

This is an account/identity ban, **not proof that a human cannot register under
a different verified identity**. Disposable email domain screening and rate
limits mitigate that risk but cannot guarantee perfect attribution. Ordinary
admin unban cannot reverse this denial. Any exceptional removal would require
an explicit owner-authorized and independently reviewed database change,
retaining the incident record and audit reason. Removing app code alone does
not delete the permanent-ban table. Protect original account IDs and evidence.
