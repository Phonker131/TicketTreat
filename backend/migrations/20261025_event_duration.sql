ALTER TABLE demo_event_pilot_settings
  ADD COLUMN IF NOT EXISTS event_duration_minutes INTEGER NOT NULL DEFAULT 180;
ALTER TABLE demo_event_pilot_settings
  ADD CONSTRAINT demo_event_pilot_settings_duration_bound
  CHECK (event_duration_minutes BETWEEN 15 AND 1440);
