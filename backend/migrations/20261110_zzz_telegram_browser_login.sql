-- One-time cross-device bot-authorized website login (no BotFather OIDC keys required).
-- A browser-only verifier is kept as a hash; the Telegram deep link contains
-- a different random challenge. A code alone NEVER establishes a session.
CREATE TABLE IF NOT EXISTS demo_telegram_browser_logins (
    code_hash VARCHAR(64) PRIMARY KEY,
    verifier_hash VARCHAR(64) NOT NULL,
    pin_hash VARCHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    telegram_id BIGINT NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    username VARCHAR(255) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_telegram_browser_login_status CHECK (status IN ('pending','claimed','consumed'))
);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_browser_logins_expiry
    ON demo_telegram_browser_logins(expires_at);
