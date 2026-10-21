-- Apply ONCE to the existing PostgreSQL database BEFORE running the new app.
-- Back up database first. Keep prior profiles and registration IDs unchanged.
BEGIN;
ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN telegram_id TYPE BIGINT;
CREATE TABLE IF NOT EXISTS web_email_identities (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  email VARCHAR(320) NOT NULL UNIQUE, password_hash VARCHAR(300) NOT NULL
);
CREATE TABLE IF NOT EXISTS web_sessions (
  id SERIAL PRIMARY KEY, token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id), expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS web_pending_signups (
  email VARCHAR(320) PRIMARY KEY, password_hash VARCHAR(300) NOT NULL,
  code_hash VARCHAR(64) NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_web_sessions_token_hash ON web_sessions(token_hash);
CREATE INDEX IF NOT EXISTS ix_web_email_identities_email ON web_email_identities(email);
COMMIT;
