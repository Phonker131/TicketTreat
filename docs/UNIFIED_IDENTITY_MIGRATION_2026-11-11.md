# TicketTreat unified identity migration — 11 November 2026

## Phase 1 — close secondary-account creation from an active session

Status: implemented in `security/auth-no-parallel-signup-20261111` (requires CI/review and a deployment).

- A verified Telegram Mini App launch already blocks password and quick signup.
- Newly added protection also blocks all three creation endpoints when an
  existing, valid website bearer session is present:
  `/demo/auth/signup`, `/demo/auth/quick/request`,
  `/demo/auth/quick/confirm`.
- Use `409 already_authenticated_use_account_settings` to direct the user
  toward adding an independently verified email or linking a provider.
- A supplied invalid bearer fails closed with 401. No cookies or session
  identifiers are interpreted as proof without server-side validation.
- Separately, the frontend should make cross-provider Telegram linking an
  explicit, unchecked-by-default choice.

**Important boundary:** a user on a genuinely different device, without
an authenticated session or signed Telegram proof, cannot be reliably
recognized as the same person. Never merge based on names, phone numbers,
unverified email text, Telegram usernames or location. Preventing *all*
cross-device duplicate-person registrations requires voluntary two-proof
linking and safe existing-account discovery, not guesswork.

## Read-only production preflight (no personal details in output)

Run these against an isolated, restored production PostgreSQL snapshot first.
Only use aggregate counts in operational logs, not raw email addresses.

```sql
-- Case/whitespace-normalized email collision groups (should be zero).
SELECT count(*) AS normalized_email_collision_groups
FROM (
  SELECT lower(btrim(email))
  FROM demo_web_accounts
  WHERE email IS NOT NULL
  GROUP BY lower(btrim(email))
  HAVING count(*) > 1
) AS collision_groups;

-- Telegram links referencing a missing ticket owner.
SELECT count(*) AS orphan_telegram_guest_links
FROM demo_telegram_identities ti
LEFT JOIN demo_guests g ON g.id = ti.guest_id
WHERE g.id IS NULL;

-- Web accounts referencing a missing ticket owner.
SELECT count(*) AS orphan_web_guests
FROM demo_web_accounts a
LEFT JOIN demo_guests g ON g.id = a.guest_id
WHERE g.id IS NULL;

-- Telegram identities without a canonical website account (expected
-- for bot-only profiles until first verified website login).
SELECT count(*) AS pending_telegram_only_migrations
FROM demo_telegram_identities ti
LEFT JOIN demo_web_accounts a ON a.guest_id = ti.guest_id
WHERE a.id IS NULL;

-- Registered bot users that have never established a verified Telegram
-- mapping to the canonical ticket-owner table.
SELECT count(*) AS legacy_bot_users_without_verified_mapping
FROM users u
LEFT JOIN demo_telegram_identities ti ON ti.telegram_id = u.telegram_id
WHERE ti.telegram_id IS NULL;

-- Count existing email reservations that have not yet been verified.
SELECT count(*) AS unverified_email_reservations
FROM demo_web_accounts a
LEFT JOIN demo_verified_emails v ON v.account_id = a.id
WHERE a.email IS NOT NULL AND v.account_id IS NULL;
```

## Phase 2 — provider identity ledger

Proposed canonical table: `auth_identities(account_id, provider,
provider_subject, verified_at, created_at)`. The unique
`(provider, provider_subject)` must be enforced in PostgreSQL, not only
application-side; `account_id` references `demo_web_accounts(id)` until
the final account-model rename. Initial sources are verified email claims,
Google OIDC subject and signed Telegram user ID (never Telegram OIDC `sub`
as the Bot API ID).

Before enabling this table for authentication:

1. Confirm a successful encrypted backup **and a restore drill**.
2. Audit normalized email and provider mapping conflicts from a restored DB.
3. Introduce additive DDL and deterministic idempotent backfill.
4. Keep provider mapping creation, transfer and email attachment in the
   **same transaction** as the canonical account changes.
5. Use PostgreSQL unique constraints, row locks / atomic upserts and
   repeatable concurrent login tests. Never silently replace a provider owner.
6. Handle Telegram-shadow-account transfers and session revocation explicitly.

Do not add a half-populated identity table as an authorization source.

## Phase 3 — all new registration uses one canonical account

- Password/email registration must verify email via one-use OTP *before*
  reserving the unique email identity. For existing unverified accounts use a
  safe reclaim/recovery path with expiry, rate limiting and no enumeration.
- Google and Telegram logins resolve only by verified provider identity;
  when a second provider is presented, prompt to connect an existing account
  using proof of both identities. Never create/merge by email equality alone.
- Disable legacy bot profile and `Registration` writers only after
  migration to the one canonical attendee/booking store, preserving prior
  registrations, issued tickets, check-in history and organizer roles.

## Phase 4 — release gate

At minimum validate:
- email -> Google -> Telegram and Telegram -> email -> Google;
- two different people on separate Telegram IDs never share tickets;
- same provider simultaneously in 20+ transactions yields one principal;
- expired/forged OIDC, stale sessions and Mini App initData fail closed;
- before/after booking counts and QR ownership match on restored DB;
- attendee, organizer and admin MFA flows;
- existing-account two-proof links, conflicts and session revocation;
- real devices (iOS Safari, Telegram Mini App and desktop).

**Rollout:** isolated restored database -> staging -> small production
canary with aggregate monitors -> full cutover -> disable legacy
creation endpoints. Rollback code without reverting additive schema or
destructively removing tickets. Never perform production account merges
as a side-effect of deploying the phase-1 guard.
