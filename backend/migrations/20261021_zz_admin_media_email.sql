-- Additive migration. Only apply after taking and verifying a staging backup.
CREATE TABLE IF NOT EXISTS demo_global_admin_delegations (
    account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id),
    email VARCHAR(255) NOT NULL,
    granted_by INTEGER NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_demo_global_admin_delegations_active
ON demo_global_admin_delegations(account_id) WHERE revoked_at IS NULL;
