-- Append-only ban/unban history. Existing accounts, registrations and tickets
-- are never deleted or rewritten by this migration.
CREATE TABLE IF NOT EXISTS demo_account_ban_actions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    actor_account_id INTEGER NOT NULL,
    action VARCHAR(12) NOT NULL CHECK (action IN ('ban', 'unban')),
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_demo_account_ban_actions_account_id
    ON demo_account_ban_actions(account_id);
CREATE INDEX IF NOT EXISTS ix_demo_account_ban_actions_account_id_id
    ON demo_account_ban_actions(account_id, id);
