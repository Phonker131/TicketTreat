# Incident follow-up: revoke residual authentication material — 2026-11-25

## Findings

- Production browser access uses a PostgreSQL-backed `WebSession`. Previous
  incident migrations already revoked web sessions for the two permanently
  banned accounts. New login through email, Google, Telegram and bot-approved
  browser links checks the account ban before issuing another session.
- A separate email verification/recovery router had its **own** session reader
  that did not check bans. In the event an orphan session row survived, that
  reader could still allow email-security actions. Password reset and email
  magic-code requests also generated or consumed authentication material for
  banned accounts (without restoring their login access).
- MFA elevation rows, pending email challenges and Telegram email claims were
  not removed by the previous session revocation. These factors are unusable
  without a valid web session, but retaining them is unnecessary.
- Client browsers can retain an HttpOnly cookie after a server-side ban, but
  cookie possession does not restore the deleted session row. The gateway
  forwards it to the API, which refuses invalid/blocked sessions.

## Fix

1. Apply `require_account_active` to the recovery router's session reader and
   challenge creation function, even if a session row unexpectedly survives.
2. Suppress new password reset and magic-code emails for banned accounts using
   the same generic response as unknown emails (no account enumeration).
   Reject password-reset completion for banned accounts before any mutation.
3. When an administrator bans an account, revoke **all** of its WebSession,
   MFASession, EmailChallenge and TelegramEmailClaim records atomically with
   the ban. Ordinary account unbans remain possible for other users.
4. A forward-only SQL migration removes those artifacts plus any pending
   Telegram-browser handoffs for previously permanently banned accounts. It
   targets the existing permanent-ban ledger and contains no identifiers or
   secrets. Identity mappings and audit records are deliberately retained so
   the same providers cannot silently create fresh independent accounts.

## Verification and recovery

- Unit suite, disposable PostgreSQL integration suite and Chromium E2E must
  pass. CI adds a stale-session simulation showing the independent email
  router returns `403 account_banned`, and checks revoked factor row counts.
- After owner approval, release through PR to `release/tickettreat-production`;
  Railway migrations run transactionally before the server starts. Confirm
  both `Backend` and `TicketTreat API` reach terminal `SUCCESS`, verify the
  migration filename appears in runtime logs, and run read-only health/API
  smoke checks.
- A production read-only SQL check is still required to **prove** that both
  accounts have exactly zero remaining web sessions, MFA elevations and email
  challenges. API/proxy logs alone cannot prove a negative fact about rows in
  PostgreSQL. Do not use integration fixtures on production data.
- This migration only deletes revocable session/challenge artifacts and is
  safe to rerun; it does not drop account or incident evidence. Rolling back
  application code would not resurrect expired/deleted tokens. Restoring a
  pre-fix DB backup would require reapplying all permanent bans and revocations
  before allowing external traffic.
