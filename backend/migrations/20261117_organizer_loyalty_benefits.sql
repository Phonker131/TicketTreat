-- Configurable bilingual descriptions of organization-wide loyalty tiers.
-- Privileges remain server-enforced; this does not create redeemable tokens.
CREATE TABLE IF NOT EXISTS organizer_loyalty_benefits (
    id SERIAL PRIMARY KEY,
    owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
    tier VARCHAR(16) NOT NULL CHECK (tier IN ('newcomer','regular','insider','vip')),
    label_en VARCHAR(100) NOT NULL,
    label_cs VARCHAR(100) NOT NULL,
    priority_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_organizer_loyalty_tier UNIQUE (owner_account_id, tier)
);
CREATE INDEX IF NOT EXISTS ix_organizer_loyalty_benefits_owner_account_id
    ON organizer_loyalty_benefits(owner_account_id);
