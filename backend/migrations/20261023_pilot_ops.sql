-- Additive, pilot-only settings and least-privilege check-in staffing.
-- Run via migration ledger after rehearsed staging backup/restore.
CREATE TABLE IF NOT EXISTS demo_event_pilot_settings (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  signup_cutoff_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (signup_cutoff_minutes BETWEEN 0 AND 10080),
  reminder_minutes_json VARCHAR(100) NOT NULL DEFAULT '[10080,1440,180]'
);
CREATE TABLE IF NOT EXISTS demo_event_checkin_staff (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  granted_by INTEGER NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_checkin_staff UNIQUE (event_id,account_id)
);
CREATE INDEX IF NOT EXISTS ix_event_checkin_staff_event_id
  ON demo_event_checkin_staff(event_id);
