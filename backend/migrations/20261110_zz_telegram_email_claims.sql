-- Optional email verification for accounts first created via Telegram.
-- The address becomes the account login only AFTER the eight-digit OTP proof.
CREATE TABLE IF NOT EXISTS demo_telegram_email_claims (
    account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
);
