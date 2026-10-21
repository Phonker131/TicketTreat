-- New organizer events are private drafts. Unmarked historical events stay public.
-- Applied through backend/migrations/apply.py only after staging backup/restore.
CREATE TABLE IF NOT EXISTS demo_event_publications (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','scheduled','published')),
    publish_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_demo_event_publications_schedule
ON demo_event_publications(publish_at)
WHERE status='scheduled';
