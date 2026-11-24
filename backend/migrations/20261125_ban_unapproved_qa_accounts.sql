-- Owner-authorized response to unsolicited QA registrations, 2026-11-25.
-- Exact account ID + email pairs are both required to avoid touching any
-- unrelated account in other environments. Record system actor 0, not a
-- fictitious human administrator. Existing tickets/messages/data are kept.
WITH targets(account_id, email) AS (
    VALUES
      (42, 'ttqa20261125@euploading.com'),
      (43, 'ttorg20261125@euploading.com')
)
INSERT INTO demo_account_ban_actions
    (account_id, actor_account_id, action, reason, created_at)
SELECT a.id, 0, 'ban',
       'Owner-authorized security suspension: unsolicited automated QA and disposable email',
       NOW()
FROM demo_web_accounts a
JOIN targets t ON t.account_id = a.id AND LOWER(a.email) = t.email
WHERE NOT EXISTS (
    SELECT 1 FROM demo_account_ban_actions existing
    WHERE existing.id = (
        SELECT id FROM demo_account_ban_actions
        WHERE account_id = a.id ORDER BY id DESC LIMIT 1
    ) AND existing.action = 'ban'
);

-- Revoke already-issued browser sessions as part of the same transaction.
DELETE FROM demo_web_sessions s
USING demo_web_accounts a
WHERE s.account_id = a.id
  AND ((a.id = 42 AND LOWER(a.email) = 'ttqa20261125@euploading.com')
    OR (a.id = 43 AND LOWER(a.email) = 'ttorg20261125@euploading.com'));

UPDATE demo_organizer_applications o
SET status = 'rejected', decided_at = NOW(), decided_by = NULL
FROM demo_web_accounts a
WHERE o.account_id = a.id AND o.status = 'pending'
  AND ((a.id = 42 AND LOWER(a.email) = 'ttqa20261125@euploading.com')
    OR (a.id = 43 AND LOWER(a.email) = 'ttorg20261125@euploading.com'));
