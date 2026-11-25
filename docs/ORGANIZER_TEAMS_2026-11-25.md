# TicketTreat organizer teams — security and operating guide

An organization remains the existing verified **organizer web account** that
owns all of its events. `tt_organizer_team_members` authorizes additional
individual, verified web accounts to manage that owner's events. It does not
merge identities, create a new administrator, or transfer event ownership.

## Onboarding Amber Events and other teams

1. Each person creates or signs in to their **own** TicketTreat account and
   verifies its email. They must not share the Amber login/password.
2. The existing Amber organizer signs in, verifies MFA, opens **Organizer
   dashboard → Organizer team**, and invites each teammate by their verified
   TicketTreat email address (maximum 12). An invitation lasts seven days.
3. Each recipient opens **Profile → Organizer team**, accepts the invitation,
   and sets up/verifies MFA. Only acceptance grants event-management access.
4. Each participant links **their own Telegram** in their TicketTreat profile,
   opens `/admin/notifications`, and enables registration/cancellation alerts.
   They must have started the TicketTreat bot in that Telegram chat so that it
   can deliver direct messages. A Telegram username alone cannot be used for
   delivery.
5. A team member can manage existing Amber events. When creating an event,
   they must select the owning organization if more than one is available.
   Events are owned by Amber, not the individual worker.

The owner can remove a member from the team screen; the member can leave or
disable event alerts for that organization. Revocation takes effect on the next
server authorization check and any *queued* Telegram alert is re-authorized
before actual delivery. An already delivered message cannot be recalled.

## Invariants

- Organizer role, verified email, absence of ban, active invitation acceptance
  and member MFA are checked on the server. A self-declared organization name
  or email address is insufficient to grant access.
- A team member cannot edit an unrelated organizer's events and cannot access
  global admin operations. Actual account role remains `participant` when that
  was their original role.
- Deleting an event and editing the public organizer profile remain restricted
  to the actual owner (or global admin for event deletion).
- Guest activity fanout resolves individual Telegram IDs from signed, unique
  account links and applies per-user category preferences. No contact details,
  QR data, or message contents are included in the alert payload.
- Membership changes are recorded in `tt_organizer_team_audit`; rejected
  attempts cannot grant access. Invites are serialized under an owner row lock
  to enforce the 12-member limit, and membership updates use row locks.
- No named person has been automatically granted access. The email recipient
  must exist and explicitly accept their own invitation.

## Rollout and verification

Add the additive `20261125_zzzz_organizer_teams.sql` migration and deploy the
backend before deploying the new frontend. Run
`python -m unittest discover -s backend/src/tests -p 'integration_*.py' -v`
against a disposable PostgreSQL `tickettreat_ci` database, the Telegram unit
tests, and the frontend production build. Do not rerun the migration by editing
its applied checksum. The new routes are `/demo/manage/teams*`. Frontend pages:
`/admin/team` and `/admin/notifications`.

If a rollback is needed, revert the application to the previous release while
leaving the additive team tables intact; do not delete the audit history. An
owner can revoke all memberships in the organizer team UI.
