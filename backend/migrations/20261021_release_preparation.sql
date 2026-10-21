-- Crowdly/TicketTreat release preparation, additive PostgreSQL migration.
-- Run against a BACKED-UP staging database before production.
-- Existing accounts, sessions, legacy bot registrations and tickets are untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS demo_verified_emails (
    account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id),
    verified_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_email_challenges (
    account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
    purpose VARCHAR(16) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, purpose)
);
CREATE TABLE IF NOT EXISTS demo_event_media (
    event_id INTEGER PRIMARY KEY,
    gallery_json TEXT NOT NULL DEFAULT '[]',
    video_url VARCHAR(2048)
);
CREATE TABLE IF NOT EXISTS demo_site_landing (
    id INTEGER PRIMARY KEY,
    headline VARCHAR(140) NOT NULL,
    subtitle TEXT NOT NULL,
    hero_image_type VARCHAR(40),
    hero_image_bytes BYTEA
);
CREATE TABLE IF NOT EXISTS demo_privacy_requests (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
    request_type VARCHAR(24) NOT NULL DEFAULT 'erasure',
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_privacy_requests_account_id
  ON demo_privacy_requests(account_id);
CREATE TABLE IF NOT EXISTS demo_account_admin_audit (
    id SERIAL PRIMARY KEY,
    actor_account_id INTEGER NOT NULL,
    target_account_id INTEGER NOT NULL,
    action VARCHAR(48) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_account_admin_audit_actor_account_id
  ON demo_account_admin_audit(actor_account_id);
CREATE INDEX IF NOT EXISTS ix_demo_account_admin_audit_target_account_id
  ON demo_account_admin_audit(target_account_id);
CREATE TABLE IF NOT EXISTS demo_mfa_factors (
    account_id INTEGER PRIMARY KEY,
    encrypted_secret BYTEA NOT NULL,
    enabled_at TIMESTAMPTZ,
    last_counter INTEGER,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_mfa_sessions (
    session_hash VARCHAR(64) PRIMARY KEY,
    account_id INTEGER NOT NULL,
    verified_until TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_mfa_sessions_account_id ON demo_mfa_sessions(account_id);
COMMIT;
