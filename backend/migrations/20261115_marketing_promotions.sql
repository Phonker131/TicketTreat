-- Marketing promotions: independent of QR attendance and standard loyalty tiers.
-- Sponsor is resolved from an organizer-owned event; IG claims need human approval.
CREATE TABLE IF NOT EXISTS demo_promo_campaigns (
  id SERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  anchor_event_id INTEGER NOT NULL REFERENCES events(id),
  event_id INTEGER REFERENCES events(id),
  created_by INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger VARCHAR(24) NOT NULL,
  reward_kind VARCHAR(24) NOT NULL DEFAULT 'vip_perk',
  reward_title VARCHAR(100) NOT NULL,
  reward_details VARCHAR(500) NOT NULL DEFAULT '',
  instagram_url VARCHAR(200) NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  benefit_expires_at TIMESTAMPTZ,
  status VARCHAR(12) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_promo_trigger CHECK (trigger IN ('account_signup','event_booking','instagram_follow')),
  CONSTRAINT ck_promo_reward CHECK (reward_kind IN ('vip_perk','badge','other')),
  CONSTRAINT ck_promo_status CHECK (status IN ('draft','active','paused')),
  CONSTRAINT ck_promo_window CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '31 days'),
  CONSTRAINT ck_promo_benefit_expiry CHECK (benefit_expires_at IS NULL OR benefit_expires_at > ends_at),
  CONSTRAINT ck_promo_event_scope CHECK ((trigger='event_booking' AND event_id IS NOT NULL) OR (trigger<>'event_booking' AND event_id IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_demo_promo_campaigns_owner_account_id ON demo_promo_campaigns(owner_account_id);
CREATE INDEX IF NOT EXISTS ix_promo_campaigns_active ON demo_promo_campaigns(status,starts_at,ends_at);

CREATE TABLE IF NOT EXISTS demo_promo_claims (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES demo_promo_campaigns(id),
  account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  instagram_username VARCHAR(64) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES demo_web_accounts(id),
  CONSTRAINT uq_promo_claim_account UNIQUE (campaign_id,account_id),
  CONSTRAINT ck_promo_claim_status CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT ck_promo_claim_review CHECK ((status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status<>'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_demo_promo_claims_campaign_id ON demo_promo_claims(campaign_id);
CREATE INDEX IF NOT EXISTS ix_demo_promo_claims_account_id ON demo_promo_claims(account_id);
