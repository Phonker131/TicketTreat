-- Invitation-only event visibility. A row marks an event unlisted; absent row is public.
-- Tokens are 256-bit secrets. Historical events remain public by default.
-- Forward-only migration; never edit existing applied SQL files.
CREATE TABLE IF NOT EXISTS demo_event_invites (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    invite_token VARCHAR(64) NOT NULL UNIQUE,
    CONSTRAINT ck_demo_event_invites_token_len CHECK (length(invite_token) = 43)
);
