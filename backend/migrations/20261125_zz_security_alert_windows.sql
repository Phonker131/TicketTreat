CREATE TABLE IF NOT EXISTS demo_security_alert_windows (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER NOT NULL,
    kind VARCHAR(24) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    first_operation VARCHAR(255) NOT NULL,
    alerted_at TIMESTAMPTZ,
    request_id VARCHAR(32) UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_security_alert_actor_kind_start
    ON demo_security_alert_windows (actor_id, kind, started_at);
