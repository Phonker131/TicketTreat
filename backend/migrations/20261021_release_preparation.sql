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
CREATE TABLE IF NOT EXISTS demo_legacy_ticket_claims (
    registration_id INTEGER PRIMARY KEY,
    event_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL UNIQUE,
    claimed_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(24) NOT NULL DEFAULT 'telegram'
);
CREATE INDEX IF NOT EXISTS ix_demo_legacy_ticket_claims_event_id
    ON demo_legacy_ticket_claims(event_id);

-- On an existing deployment this index may expose duplicate historical bot
-- registrations. Inspect and reconcile those rows on staging before applying.
DO $
BEGIN
    IF EXISTS (
        SELECT 1 FROM registrations GROUP BY user_id,event_id HAVING COUNT(*)>1
    ) THEN
        RAISE EXCEPTION 'Duplicate bot registrations: reconcile before applying unique index';
    END IF;
END $;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_user_event
    ON registrations(user_id,event_id);
-- Telegram IDs can exceed the signed PostgreSQL INTEGER range.
ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT USING telegram_id::BIGINT;
ALTER TABLE demo_privacy_requests
    ADD COLUMN IF NOT EXISTS resolution_note VARCHAR(500),
    ADD COLUMN IF NOT EXISTS resolved_by INTEGER,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS demo_organizer_applications (
    account_id INTEGER PRIMARY KEY,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL,
    decided_at TIMESTAMPTZ,
    decided_by INTEGER
);
COMMIT;
