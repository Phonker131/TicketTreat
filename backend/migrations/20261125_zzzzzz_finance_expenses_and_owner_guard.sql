-- Future bookkeeping without live payments: owner-entered costs are NEVER
-- provider-verified sales, tax deductions or official tax documents.
CREATE TABLE IF NOT EXISTS tt_finance_expense_entries (
  id BIGSERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  actor_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
  event_id INTEGER REFERENCES events(id),
  entry_type VARCHAR(12) NOT NULL,
  reverses_entry_id BIGINT UNIQUE REFERENCES tt_finance_expense_entries(id),
  category VARCHAR(24) NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL,
  expense_date DATE NOT NULL,
  supplier VARCHAR(160),
  reference VARCHAR(120),
  note VARCHAR(400),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_finance_expense_category CHECK (
    category IN ('venue','staff','equipment','marketing','travel','services','other')),
  CONSTRAINT ck_finance_expense_currency CHECK (currency IN ('CZK','EUR')),
  CONSTRAINT ck_finance_expense_signed_entry CHECK (
    (entry_type='expense' AND amount_minor>0 AND reverses_entry_id IS NULL) OR
    (entry_type='reversal' AND amount_minor<0 AND reverses_entry_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_tt_finance_expense_owner_month
  ON tt_finance_expense_entries(owner_account_id,currency,expense_date,id);
CREATE INDEX IF NOT EXISTS ix_tt_finance_expense_event
  ON tt_finance_expense_entries(event_id,owner_account_id);

-- Existing append-only function is installed by the preceding finance migration.
CREATE TRIGGER tt_finance_expenses_immutable
  BEFORE UPDATE OR DELETE ON tt_finance_expense_entries
  FOR EACH ROW EXECUTE FUNCTION tt_finance_forbid_mutation();

-- Defense in depth: even future provider ingestion cannot associate a
-- payment with an event owned by a different organization.
CREATE OR REPLACE FUNCTION tt_finance_ledger_owner_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM demo_event_ownership
    WHERE event_id=NEW.event_id AND owner_account_id=NEW.owner_account_id
  ) THEN
    RAISE EXCEPTION 'finance_event_owner_mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tt_finance_ledger_owner_validation
  BEFORE INSERT ON tt_finance_ledger
  FOR EACH ROW EXECUTE FUNCTION tt_finance_ledger_owner_guard();

-- Append-only expense correction records must be exact inversions of the
-- entry being corrected. Ownership, currency, event and category cannot change.
CREATE OR REPLACE FUNCTION tt_finance_expense_insert_guard() RETURNS trigger AS $$
-- DBAPI raw SQL paths treat percent signs as bind markers; RECORD avoids
-- psycopg2 interpolation of PostgreSQL's percent-ROWTYPE syntax.
DECLARE original RECORD;
BEGIN
  IF NEW.entry_type='expense' AND NEW.event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM demo_event_ownership
    WHERE event_id=NEW.event_id AND owner_account_id=NEW.owner_account_id
  ) THEN
    RAISE EXCEPTION 'finance_expense_event_owner_mismatch';
  END IF;
  IF NEW.entry_type = 'reversal' THEN
    SELECT * INTO original FROM tt_finance_expense_entries
      WHERE id=NEW.reverses_entry_id FOR UPDATE;
    IF NOT FOUND OR original.entry_type <> 'expense'
       OR original.owner_account_id <> NEW.owner_account_id
       OR original.currency <> NEW.currency
       OR original.category <> NEW.category
       OR original.event_id IS DISTINCT FROM NEW.event_id
       OR original.amount_minor <> -NEW.amount_minor THEN
      RAISE EXCEPTION 'finance_invalid_expense_reversal';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tt_finance_expense_insert_validation
  BEFORE INSERT ON tt_finance_expense_entries
  FOR EACH ROW EXECUTE FUNCTION tt_finance_expense_insert_guard();
