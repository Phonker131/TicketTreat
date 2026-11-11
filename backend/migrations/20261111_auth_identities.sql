-- Phase 2 / expand-only: verified identities point at one canonical web account.
-- This table is intentionally empty on deployment: no guessed or silent merges,
-- and no authentication endpoint reads it until a separately reviewed cutover.
-- Idempotent, additive DDL; do not mutate historical account or ticket rows.
CREATE TABLE IF NOT EXISTS auth_identities (
    id BIGSERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL,
    provider_subject VARCHAR(255) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_auth_identities_provider_subject UNIQUE (provider, provider_subject),
    CONSTRAINT uq_auth_identities_account_provider UNIQUE (account_id, provider),
    CONSTRAINT ck_auth_identities_provider CHECK (provider IN ('email', 'google', 'telegram')),
    CONSTRAINT ck_auth_identities_nonempty CHECK (length(btrim(provider_subject)) > 0),
    CONSTRAINT ck_auth_identities_canonical_email CHECK (
        provider <> 'email' OR provider_subject = lower(btrim(provider_subject))
    )
);
-- Both unique constraints create B-tree indexes for provider resolution and
-- account/provider access. No additional index is necessary for phase 2.
