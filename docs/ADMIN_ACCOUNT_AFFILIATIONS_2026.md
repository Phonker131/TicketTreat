# Account affiliation labels in the global-admin account list

## Scope

- The existing global-admin-only `GET /demo/manage/accounts` now returns optional `organizer_name` and `team_memberships` fields alongside each account's unchanged canonical `role`.
- Team affiliations reflect the existing `tt_organizer_team_members` table. Only accepted members appear as active; pending invites appear as invited if not expired. Revoked memberships, expired invitations, invalid owners and archived merged accounts do not appear as current affiliations.
- Organizer names come from the existing organizer profile, with a neutral `Organizer #ID` fallback when no profile exists.
- The account UI renders labels and organization names. It does not create or grant memberships or change organizer/administrator privileges.

## Security and rollout

- No new endpoint, public response, database schema, migration, permission, or update action. Existing `admin_account` authorization and the privileged session/MFA boundary remain intact.
- A visitor and an organizer team member without global-admin authorization must still receive HTTP 403 on the account listing.
- No member emails, Telegram identities, or event attendee records are added to the affiliation fields.
- Deploy API before frontend, so the frontend remains compatible with older responses that omit the new optional fields.
- On failure, revert the API change and/or the frontend display. No data migration or backfill is involved.

## Verification

- `integration_admin_account_affiliations.py` covers global-admin/MFA isolation, participant vs organizer role, active vs pending membership, expiry, revocation, and invalid-owner handling on disposable PostgreSQL (`tickettreat_ci`).
- `admin-accounts-merged-locale.spec.ts` covers the Czech UI labels and the distinction between accepted and pending team membership.
- Protected backend-file review by `@Phonker131` is required before production merge according to `docs/CRITICAL_CODE_AREAS.md`.
