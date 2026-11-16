-- Additive preferences for optional manual broadcasts. Automatic transactional notices are unchanged.
CREATE TABLE IF NOT EXISTS demo_broadcast_preferences (
    account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    telegram_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
