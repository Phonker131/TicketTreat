-- Clean up residual credential material for accounts permanently excluded by
-- the incident response. This is idempotent and touches no active users.
-- The prior reviewed permanent-ban ledger determines the exact scope; account
-- IDs, emails, passwords and token values do not appear in this migration.
DELETE FROM demo_mfa_sessions
WHERE account_id IN (SELECT account_id FROM demo_permanent_account_bans);

DELETE FROM demo_email_challenges
WHERE account_id IN (SELECT account_id FROM demo_permanent_account_bans);

DELETE FROM demo_telegram_email_claims
WHERE account_id IN (SELECT account_id FROM demo_permanent_account_bans);

DELETE FROM demo_telegram_browser_logins login
USING demo_telegram_identities tg, demo_web_accounts account,
      demo_permanent_account_bans banned
WHERE login.telegram_id = tg.telegram_id
  AND tg.guest_id = account.guest_id
  AND account.id = banned.account_id;

DELETE FROM demo_web_sessions
WHERE account_id IN (SELECT account_id FROM demo_permanent_account_bans);
