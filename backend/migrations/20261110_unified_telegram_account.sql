-- One canonical TicketTreat account can originate from a verified Telegram ID
-- before the user supplies any email address. Existing email accounts remain unchanged.
ALTER TABLE demo_web_accounts ALTER COLUMN email DROP NOT NULL;

-- OAuth Authorization Code + PKCE: one-use state is stored as hashes only.
CREATE TABLE IF NOT EXISTS demo_telegram_oidc_flows (
    state_hash VARCHAR(64) PRIMARY KEY,
    verifier_hash VARCHAR(64) NOT NULL,
    nonce VARCHAR(100) NOT NULL,
    account_id INTEGER NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
    session_hash VARCHAR(64) NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_oidc_flows_expiry
    ON demo_telegram_oidc_flows(expires_at);
