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

CREATE TABLE IF NOT EXISTS demo_event_gallery_images (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL,
    image_bytes BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_event_gallery_images_event_id
ON demo_event_gallery_images(event_id);

CREATE TABLE IF NOT EXISTS demo_event_notices (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    kind VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_demo_event_notices_event_id
ON demo_event_notices(event_id);
ALTER TABLE demo_email_outbox
    ADD COLUMN IF NOT EXISTS notice_id INTEGER REFERENCES demo_event_notices(id);
