CREATE TABLE IF NOT EXISTS demo_broadcast_images (
    token VARCHAR(64) PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
    content_type VARCHAR(40) NOT NULL,
    image_bytes BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_demo_broadcast_images_account_id ON demo_broadcast_images(account_id);
