-- New independent identities; never backfill from email or merge implicitly.
CREATE TABLE IF NOT EXISTS demo_facebook_identities (
    subject VARCHAR(255) PRIMARY KEY,
    account_id INTEGER NOT NULL UNIQUE REFERENCES demo_web_accounts(id),
    created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_facebook_flows (
    state_hash VARCHAR(64) PRIMARY KEY,
    browser_hash VARCHAR(64) NOT NULL,
    account_id INTEGER REFERENCES demo_web_accounts(id),
    session_hash VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_facebook_flows_expires_at ON demo_facebook_flows(expires_at);
CREATE TABLE IF NOT EXISTS demo_facebook_pending (
    token_hash VARCHAR(64) PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_facebook_pending_expires_at ON demo_facebook_pending(expires_at);
