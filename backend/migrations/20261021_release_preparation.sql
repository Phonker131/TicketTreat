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
COMMIT;
