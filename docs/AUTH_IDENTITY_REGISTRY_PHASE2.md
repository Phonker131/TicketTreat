# Canonical identity registry — phase 2 (expand-only)

Status: **staged and inactive**. This change **does not alter account resolution,
ticket ownership, Google/Telegram/email login, roles or active web sessions**.
It introduces a constrained relational ledger so a later reviewed release can
make every authenticated provider point to exactly one canonical TicketTreat
account.

## Database schema

`auth_identities(account_id, provider, provider_subject, verified_at, created_at)`

- `account_id` references the existing `demo_web_accounts.id` canonical login.
  Until legacy bot consolidation, tickets still belong to the account's
  `demo_guests.id` through the existing unique `guest_id` link.
- Unique `(provider, provider_subject)`: the same independently proven Google
  OAuth `sub`, canonical email or **Telegram numeric Bot API ID** cannot map to
  different accounts.
- Unique `(account_id, provider)`: the current platform supports one identity
  of each provider type per account. If multi-email accounts are introduced,
  this policy needs a reviewed schema migration.
- Check constraints: provider allowlist, nonblank subject, canonical lowercase
  email spelling. No claim based on unverified contact fields, first/last
  name, Telegram username, or provider email string alone.

The PostgreSQL migration is additive and creates an **empty table**. The
SQLAlchemy model matches its constraints. Existing account records are not
bulk modified, no implicit merges are attempted, and old auth paths do **not**
read from this registry yet.

## Safe audit

After restoring a recent encrypted production backup into an isolated database,
run:

```bash
DATABASE_URL="postgresql://.../restored_db" python scripts/audit_auth_identities.py
```

The script declares a read-only SQL transaction and emits only aggregate counts.
`safe_to_backfill` must be true, especially zero normalized email collisions,
orphan references, provider subject collisions and registry inconsistencies.
Telegram guests without an existing web account and unverified email
reservations are **reported but are not automatically merged or attached**.

Only an authorized operator, after a verified restore drill and review, may
run the opt-in backfill:

```bash
DATABASE_URL="postgresql://.../restored_db" python scripts/backfill_auth_identities.py
# dry run is the default
TICKETTREAT_AUTH_BACKFILL_APPROVED=YES DATABASE_URL="postgresql://.../restored_db" \
  python scripts/backfill_auth_identities.py --apply --confirmed-restored-backup
```

The backfill inserts records from these proved sources only:

1. Email — `demo_verified_emails` joined to matching account email.
2. Google — `demo_google_identities.subject` (created after verified OAuth).
3. Telegram — the numeric `demo_telegram_identities.telegram_id` mapped via
   the linked guest to its existing website account (already proved by Telegram
   signature). **Never use Telegram OIDC `sub` as Bot API ID.**

The timestamp recorded for a historical Telegram mapping is the backfill
verification time, not the historic instant of the original signature.

The tool uses an advisory lock and identity-table write lock in one
transaction. It rejects candidate collisions before writes and verifies
that every candidate maps to the intended account before commit; any conflict
rolls back the entire backfill. No guest/ticket data is moved by the tool.
It must never run as an automatic deployment or process-startup hook.

## Tests

Run the existing PostgreSQL integration workflow, including
`integration_auth_identities.py` (24 parallel claims, uniqueness, hostile
subject and owner-transfer checks) and `integration_auth_registry_audit.py`
(read-only aggregate output).

## Cutover is separate

The next implementation must make every verified login and provider binding
resolve/update this ledger **in the same transaction** as the existing
authoritative tables. Do not enable identity-ledger reads until dual-write
logic, staged backfill reconciliation, replay/race tests and a rollback plan
are complete.

**Rollback:** revert application code if necessary, but retain this additive
table and migration ledger until a separate retention review. Never drop
rows, restore old email NOT NULL constraints or delete Telegram shadows as
part of this phase.
