-- Existing verified organizer owns events; other web identities may only act
-- after a targeted, accepted and revocable invitation. No global grants.
CREATE TABLE IF NOT EXISTS tt_organizer_team_members (
  owner_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  member_account_id INTEGER NOT NULL REFERENCES demo_web_accounts(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'invited',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (owner_account_id, member_account_id),
  CONSTRAINT ck_tt_organizer_team_distinct_accounts CHECK (owner_account_id <> member_account_id),
  CONSTRAINT ck_tt_organizer_team_status CHECK (status IN ('invited', 'active', 'revoked'))
);
CREATE INDEX IF NOT EXISTS ix_tt_organizer_team_member_status
  ON tt_organizer_team_members(member_account_id, status);

CREATE TABLE IF NOT EXISTS tt_organizer_team_audit (
  id SERIAL PRIMARY KEY,
  owner_account_id INTEGER NOT NULL,
  actor_account_id INTEGER NOT NULL,
  member_account_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_tt_organizer_team_audit_action CHECK (action IN
    ('invite', 'accept', 'leave', 'revoke', 'notifications'))
);
CREATE INDEX IF NOT EXISTS ix_tt_organizer_team_audit_owner
  ON tt_organizer_team_audit(owner_account_id, created_at);
