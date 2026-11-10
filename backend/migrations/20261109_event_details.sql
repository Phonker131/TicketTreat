-- Organizer-set venue website and discovery tags (home page moods) per event.
-- Absent row means no link and no tags. Historical events are unaffected.
-- Forward-only migration; never edit existing applied SQL files.
CREATE TABLE IF NOT EXISTS demo_event_details (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    venue_url VARCHAR(2048),
    tags_json TEXT NOT NULL DEFAULT '[]'
);
