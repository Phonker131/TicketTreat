CREATE TABLE IF NOT EXISTS event_categories (
    key VARCHAR(40) PRIMARY KEY,
    en VARCHAR(80) NOT NULL,
    cs VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO event_categories (key, en, cs) VALUES
('meet','Meet people','Seznámit se'), ('friends','With friends','S přáteli'),
('listen','Listen','Poslechnout'), ('dance','Dance','Zatančit')
ON CONFLICT (key) DO NOTHING;
