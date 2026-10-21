CREATE TABLE IF NOT EXISTS demo_google_identities (
    subject VARCHAR(255) PRIMARY KEY,
    account_id INTEGER NOT NULL UNIQUE REFERENCES demo_web_accounts(id),
    created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_google_flows (
    state_hash VARCHAR(64) PRIMARY KEY,
    browser_hash VARCHAR(64) NOT NULL,
    nonce VARCHAR(64) NOT NULL,
    account_id INTEGER REFERENCES demo_web_accounts(id),
    session_hash VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_google_flows_expires_at ON demo_google_flows(expires_at);
