CREATE TABLE IF NOT EXISTS demo_quick_signups (
  email VARCHAR(255) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  privacy_version VARCHAR(24) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_quick_signup_expiry ON demo_quick_signups(expires_at);
CREATE TABLE IF NOT EXISTS demo_quick_privacy_consents (
  account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  version VARCHAR(24) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL
);
