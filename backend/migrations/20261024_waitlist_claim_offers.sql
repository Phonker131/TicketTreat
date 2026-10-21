-- Opt-in timed waitlist offers; legacy events default to immediate promotion.
ALTER TABLE demo_event_pilot_settings
  ADD COLUMN IF NOT EXISTS waitlist_offer_minutes INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS demo_waitlist_offers (
  id SERIAL PRIMARY KEY,
  waitlist_id INTEGER NOT NULL UNIQUE REFERENCES demo_waitlist(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id INTEGER NOT NULL REFERENCES demo_guests(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL DEFAULT 'offered',
  expires_at TIMESTAMPTZ NOT NULL,
  offered_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_waitlist_offers_event_status_expiry
  ON demo_waitlist_offers(event_id,status,expires_at);
CREATE INDEX IF NOT EXISTS ix_waitlist_offers_guest ON demo_waitlist_offers(guest_id);
