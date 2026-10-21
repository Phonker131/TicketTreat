ALTER TABLE demo_tickets
  ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(40) NOT NULL DEFAULT 'direct';
CREATE INDEX IF NOT EXISTS ix_demo_tickets_event_acquisition ON demo_tickets(event_id,acquisition_source);
