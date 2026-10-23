-- One-time website-to-Telegram linking challenges. Store only SHA256 code digests.
-- Retain consumed records for incident review; a scheduled purge may remove old rows.
CREATE TABLE IF NOT EXISTS demo_telegram_link_challenges (
    id SERIAL PRIMARY KEY,
    code_hash VARCHAR(64) NOT NULL UNIQUE,
    account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    telegram_id BIGINT NULL,
    CONSTRAINT ck_telegram_link_challenge_status CHECK (status IN ('pending','linked','expired'))
);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_link_challenges_account_id
    ON demo_telegram_link_challenges(account_id);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_link_challenges_expires_at
    ON demo_telegram_link_challenges(expires_at);
