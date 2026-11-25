-- Owner-scoped Telegram activity delivery; no raw guest contacts or message bodies.
CREATE TABLE IF NOT EXISTS tt_organizer_telegram_settings (
  account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  registrations BOOLEAN NOT NULL DEFAULT TRUE,
  cancellations BOOLEAN NOT NULL DEFAULT TRUE,
  waitlist BOOLEAN NOT NULL DEFAULT TRUE,
  messages BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tt_organizer_activity (
  id SERIAL PRIMARY KEY,
  dedup_key VARCHAR(180) NOT NULL UNIQUE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id INTEGER,
  action VARCHAR(24) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_tt_organizer_activity_action CHECK (action IN
    ('registered', 'cancelled', 'waitlist_joined', 'waitlist_left', 'promoted', 'message'))
);
CREATE INDEX IF NOT EXISTS ix_tt_organizer_activity_event_id ON tt_organizer_activity(event_id);
