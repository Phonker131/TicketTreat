-- Idempotent, transactional materialization of operational reminder batches.
-- Makes a single scheduling pass per event/start/offset, preventing mass
-- repeated inserts on every worker poll.
CREATE TABLE IF NOT EXISTS demo_telegram_reminder_batches (
  event_id INTEGER NOT NULL,
  start_epoch BIGINT NOT NULL,
  reminder_minutes INTEGER NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(event_id, start_epoch, reminder_minutes)
);
