-- Reviewable foundation only: no Stripe charges, VAT invoices or EET filings.
-- Existing tickets are intentionally not migrated to financial transactions.
CREATE TABLE IF NOT EXISTS tt_organizer_finance_profiles (
  owner_account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id),
  legal_name VARCHAR(255), ico VARCHAR(16), dic VARCHAR(32),
  vat_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  stripe_account_id VARCHAR(100) UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  CONSTRAINT ck_finance_vat_status CHECK (vat_status IN ('unverified','non_payer','payer','exempt'))
);

CREATE TABLE IF NOT EXISTS tt_finance_profile_audit (
  id BIGSERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL,
  actor_account_id INTEGER NOT NULL,
  action VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- An account/session-bound 15-minute unlock; the session's existence and ban
-- status are still checked on each finance request.
CREATE TABLE IF NOT EXISTS tt_finance_session_grants (
  session_hash VARCHAR(64) PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ck_finance_session_grant_expiry CHECK (expires_at > granted_at)
);
CREATE INDEX IF NOT EXISTS ix_tt_finance_session_grants_account
  ON tt_finance_session_grants(account_id,expires_at);

CREATE TABLE IF NOT EXISTS tt_finance_access_audit (
  id BIGSERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL,
  actor_account_id INTEGER NOT NULL,
  action VARCHAR(32) NOT NULL,
  request_id VARCHAR(32),
  ip_fingerprint VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_finance_access_audit_action CHECK (length(action) > 0)
);
CREATE INDEX IF NOT EXISTS ix_tt_finance_access_audit_owner_time
  ON tt_finance_access_audit(owner_account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_tt_finance_access_audit_actor_time
  ON tt_finance_access_audit(actor_account_id,created_at DESC);

CREATE TABLE IF NOT EXISTS tt_finance_ledger (
  id BIGSERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  event_id INTEGER REFERENCES events(id),
  category VARCHAR(20) NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  source VARCHAR(20) NOT NULL,
  source_key VARCHAR(200) NOT NULL,
  order_reference VARCHAR(120),
  verified_tax_minor BIGINT,
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_provider_event UNIQUE(source,source_key),
  CONSTRAINT ck_finance_category CHECK (category IN ('sale','refund','stripe_fee','payout','dispute_fee')),
  CONSTRAINT ck_finance_currency CHECK (currency IN ('CZK','EUR')),
  CONSTRAINT ck_finance_nonzero CHECK (amount_minor <> 0)
);
CREATE INDEX IF NOT EXISTS ix_tt_finance_ledger_owner_month
  ON tt_finance_ledger(owner_account_id,currency,occurred_at);

CREATE TABLE IF NOT EXISTS tt_finance_documents (
  id BIGSERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  kind VARCHAR(30) NOT NULL,
  document_number VARCHAR(80) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  storage_key VARCHAR(300) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_finance_document_number UNIQUE(owner_account_id,document_number)
);
CREATE INDEX IF NOT EXISTS ix_tt_finance_documents_owner_issued
  ON tt_finance_documents(owner_account_id,issued_at DESC);

CREATE TABLE IF NOT EXISTS tt_organizer_contract_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(40) NOT NULL,
  language VARCHAR(2) NOT NULL,
  body TEXT NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  CONSTRAINT uq_finance_contract_version UNIQUE(version,language),
  CONSTRAINT ck_finance_contract_status CHECK (status IN ('draft','published','retired')),
  CONSTRAINT ck_finance_contract_publish_time CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS tt_organizer_contract_acceptances (
  id BIGSERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  signer_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  contract_id INTEGER NOT NULL REFERENCES tt_organizer_contract_versions(id),
  contract_sha256 VARCHAR(64) NOT NULL,
  signature_method VARCHAR(24) NOT NULL DEFAULT 'web_mfa_ack',
  accepted_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_finance_contract_acceptance UNIQUE(owner_account_id,contract_id)
);
CREATE INDEX IF NOT EXISTS ix_tt_finance_contract_acceptances_signer
  ON tt_organizer_contract_acceptances(signer_account_id,accepted_at DESC);

-- Preserve immutable evidence; corrections must be new linked entries.
CREATE OR REPLACE FUNCTION tt_finance_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append_only_financial_evidence';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tt_finance_ledger_immutable BEFORE UPDATE OR DELETE ON tt_finance_ledger
  FOR EACH ROW EXECUTE FUNCTION tt_finance_forbid_mutation();
CREATE TRIGGER tt_finance_contract_acceptance_immutable BEFORE UPDATE OR DELETE ON tt_organizer_contract_acceptances
  FOR EACH ROW EXECUTE FUNCTION tt_finance_forbid_mutation();
CREATE TRIGGER tt_finance_profile_audit_immutable BEFORE UPDATE OR DELETE ON tt_finance_profile_audit
  FOR EACH ROW EXECUTE FUNCTION tt_finance_forbid_mutation();
CREATE TRIGGER tt_finance_documents_immutable BEFORE UPDATE OR DELETE ON tt_finance_documents
  FOR EACH ROW EXECUTE FUNCTION tt_finance_forbid_mutation();
CREATE TRIGGER tt_finance_access_audit_immutable BEFORE UPDATE OR DELETE ON tt_finance_access_audit
  FOR EACH ROW EXECUTE FUNCTION tt_finance_forbid_mutation();

-- Prevent retroactively altering the text someone agreed to. Drafts remain
-- editable for counsel review; published versions can only be retired.
CREATE OR REPLACE FUNCTION tt_finance_protect_published_contract() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'published_finance_contract_immutable';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.body IS DISTINCT FROM OLD.body OR
    NEW.sha256 IS DISTINCT FROM OLD.sha256 OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.language IS DISTINCT FROM OLD.language OR
    NEW.published_at IS DISTINCT FROM OLD.published_at OR
    (OLD.status = 'retired' AND NEW.status <> 'retired') OR
    NEW.status NOT IN ('published','retired')
  ) THEN
    RAISE EXCEPTION 'published_finance_contract_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tt_finance_contract_version_protection
  BEFORE UPDATE OR DELETE ON tt_organizer_contract_versions
  FOR EACH ROW EXECUTE FUNCTION tt_finance_protect_published_contract();
