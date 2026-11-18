CREATE TABLE IF NOT EXISTS event_categories (
    key VARCHAR(40) PRIMARY KEY,
    en VARCHAR(80) NOT NULL,
    cs VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO event_categories (key, en, cs, active) VALUES
('meet','Meet people','Seznámit se',TRUE), ('friends','With friends','S přáteli',TRUE),
('listen','Listen','Poslechnout',TRUE), ('dance','Dance','Zatančit',TRUE)
ON CONFLICT (key) DO NOTHING;
