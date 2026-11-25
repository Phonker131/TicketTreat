-- Owner-authorized indefinite denial of the two verified abusive QA accounts.
-- Only accounts previously suspended by the owner-authorized incident migration
-- qualify. The prior system audit record proves the original ID/email matches
-- without re-publishing personal identifiers in this change.
-- This separate ledger takes precedence over later administrative unban actions.
-- Deliberately retains account records and incident evidence.
CREATE TABLE IF NOT EXISTS demo_permanent_account_bans (
    account_id INTEGER PRIMARY KEY,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO demo_permanent_account_bans (account_id, reason)
SELECT a.id,
       'Permanent security ban authorized by owner: unsolicited automated QA activity'
FROM demo_web_accounts a
WHERE EXISTS (
    SELECT 1 FROM demo_account_ban_actions b
    WHERE b.account_id = a.id AND b.actor_account_id = 0
      AND b.action = 'ban'
      AND b.reason = 'Owner-authorized security suspension: unsolicited automated QA and disposable email'
)
ON CONFLICT (account_id) DO NOTHING;

-- Their previous sessions were revoked by 20261125_ban_unapproved_qa_accounts.
-- Revoke any session created between that migration and this one as well.
DELETE FROM demo_web_sessions s
USING demo_permanent_account_bans p
WHERE s.account_id = p.account_id
  AND p.reason = 'Permanent security ban authorized by owner: unsolicited automated QA activity';
