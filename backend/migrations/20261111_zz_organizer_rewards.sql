-- Organizer-issued attendance recognition; no automatic financial entitlements.
-- Additive, independent of existing loyalty-tier calculations and QR check-ins.
CREATE TABLE IF NOT EXISTS organizer_rewards (
  id SERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  created_by INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  title VARCHAR(80) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  kind VARCHAR(20) NOT NULL DEFAULT 'badge',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT ck_organizer_reward_kind CHECK (kind IN ('badge','recognition','perk')),
  CONSTRAINT ck_organizer_reward_title CHECK (length(btrim(title))>=3)
);
CREATE INDEX IF NOT EXISTS ix_organizer_rewards_owner_account_id
  ON organizer_rewards(owner_account_id);

CREATE TABLE IF NOT EXISTS organizer_reward_grants (
  id SERIAL PRIMARY KEY,
  reward_id INTEGER NOT NULL REFERENCES organizer_rewards(id),
  ticket_id INTEGER NOT NULL REFERENCES demo_tickets(id),
  guest_id INTEGER NOT NULL REFERENCES demo_guests(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  granted_by INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  note VARCHAR(200) NOT NULL DEFAULT '',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by INTEGER REFERENCES demo_web_accounts(id),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT uq_organizer_reward_ticket UNIQUE (reward_id,ticket_id),
  CONSTRAINT ck_reward_revoke_fields CHECK ((revoked_at IS NULL AND revoked_by IS NULL)
                                        OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_organizer_reward_grants_reward_id ON organizer_reward_grants(reward_id);
CREATE INDEX IF NOT EXISTS ix_organizer_reward_grants_ticket_id ON organizer_reward_grants(ticket_id);
CREATE INDEX IF NOT EXISTS ix_organizer_reward_grants_guest_id ON organizer_reward_grants(guest_id);
CREATE INDEX IF NOT EXISTS ix_organizer_reward_grants_event_id ON organizer_reward_grants(event_id);
