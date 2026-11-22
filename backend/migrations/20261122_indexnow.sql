CREATE TABLE IF NOT EXISTS tt_indexnow_pages (
    path VARCHAR(100) PRIMARY KEY,
    digest VARCHAR(64) NOT NULL
);

UPDATE demo_event_places AS p SET city = 'Praha'
FROM events AS e
WHERE p.event_id = e.id AND p.country_code = 'CZ' AND p.city = ''
AND ((e.id IN (16,22) AND e.location = 'Ellise Bar')
  OR (e.id IN (15,18,23) AND e.location = 'Nerd Alert')
  OR (e.id IN (17,19) AND e.location = 'Nerd Alert, Bulharská 924/26')
  OR (e.id = 21 AND e.location = 'Vodičkova 28, Prague 1'));
