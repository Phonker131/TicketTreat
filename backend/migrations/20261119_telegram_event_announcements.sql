CREATE TABLE IF NOT EXISTS demo_event_announcement_batches (
    event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    queued BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS demo_event_alert_opt_outs (
    account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id) ON DELETE CASCADE
);
INSERT INTO demo_event_announcement_batches (event_id, queued)
SELECT event_id, FALSE FROM demo_event_publications
WHERE status = 'scheduled' AND publish_at > CURRENT_TIMESTAMP
ON CONFLICT (event_id) DO NOTHING;
