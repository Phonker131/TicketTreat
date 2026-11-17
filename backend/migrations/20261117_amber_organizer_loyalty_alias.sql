-- Repair the legacy Amber Events *loyalty identity*, without merging accounts,
-- reassigning event owners, changing tickets or modifying other organizations.
-- The previously audited guest #3 -> web #4 reconciliation established the
-- canonical Amber Events web account. Historical event publishers can have
-- different owner_account_id values even after that guest reconciliation.
--
-- Explicit owner+organizer-name aliases avoid the dangerous global rule
-- "same public name = same organization". No source event or account is erased.
CREATE TABLE IF NOT EXISTS organizer_loyalty_aliases (
    id SERIAL PRIMARY KEY,
    owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
    organizer_name_key VARCHAR(120) NOT NULL,
    canonical_owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id),
    CONSTRAINT uq_loyalty_alias_owner_name UNIQUE (owner_account_id, organizer_name_key),
    CONSTRAINT ck_loyalty_alias_not_self CHECK (owner_account_id <> canonical_owner_account_id)
);
CREATE INDEX IF NOT EXISTS ix_loyalty_alias_canonical
    ON organizer_loyalty_aliases(canonical_owner_account_id);

-- Scope this backfill to the *specific* organizer the owners have verified.
-- If the canonical account/audit is absent (e.g. a new staging database),
-- do nothing and leave all unrelated organizations unaffected.
INSERT INTO organizer_loyalty_aliases
    (owner_account_id, organizer_name_key, canonical_owner_account_id)
SELECT DISTINCT own.owner_account_id, 'amber events', 4
FROM demo_event_ownership AS own
JOIN events AS ev ON ev.id = own.event_id
WHERE lower(btrim(ev.organizer)) = 'amber events'
  AND own.owner_account_id <> 4
  AND EXISTS (
      SELECT 1 FROM demo_web_accounts AS canonical
      WHERE canonical.id = 4 AND canonical.email IS NOT NULL
        AND lower(btrim(concat_ws(' ', canonical.first_name, canonical.last_name))) = 'amber events'
  )
  AND EXISTS (
      SELECT 1 FROM demo_account_admin_audit AS audited
      WHERE audited.target_account_id = 4
        AND audited.action = 'manual_empty_guest_3_to_4'
  )
ON CONFLICT (owner_account_id, organizer_name_key) DO NOTHING;
