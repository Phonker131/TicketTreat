-- Durable, owner-scoped announcement images. Public links use random 256-bit tokens.
-- No user contacts, tickets or marketing consent settings are modified.
CREATE TABLE IF NOT EXISTS demo_broadcast_images (
  token VARCHAR(43) PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  content_type VARCHAR(32) NOT NULL,
  image_bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_demo_broadcast_images_owner_account_id
  ON demo_broadcast_images (owner_account_id);
CREATE INDEX IF NOT EXISTS ix_demo_broadcast_images_created_at
  ON demo_broadcast_images (created_at);
