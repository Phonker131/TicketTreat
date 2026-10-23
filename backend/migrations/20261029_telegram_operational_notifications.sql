-- Durable Telegram delivery for event cancellations, changes and reminders.
-- No personal message content or bot credentials stored in this table.
CREATE TABLE IF NOT EXISTS demo_telegram_notification_outbox (
  id SERIAL PRIMARY KEY,
  event_key VARCHAR(180) NOT NULL UNIQUE,
  kind VARCHAR(24) NOT NULL,
  telegram_id BIGINT NOT NULL,
  event_id INTEGER NOT NULL,
  notice_id INTEGER,
  start_epoch BIGINT,
  reminder_minutes INTEGER,
  language VARCHAR(2) NOT NULL DEFAULT 'ru',
  state VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL,
  last_error VARCHAR(200),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_notification_outbox_due
ON demo_telegram_notification_outbox(state, next_attempt_at, id);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_notification_outbox_telegram_id
ON demo_telegram_notification_outbox(telegram_id);
CREATE INDEX IF NOT EXISTS ix_demo_telegram_notification_outbox_event_id
ON demo_telegram_notification_outbox(event_id);
