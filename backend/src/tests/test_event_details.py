"""Venue link and tag validation tests; no database connection required."""
import os
import sys
import unittest
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import Column, Integer, MetaData, Table, create_engine
from sqlalchemy.exc import IntegrityError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:5432/unused")
from demo_roles import (
    EVENT_TAGS, CreateManageEvent, EventDetails, UpdateManageEvent,
    normalize_tags, validate_venue_url,
)


class VenueUrlValidationTest(unittest.TestCase):
    def test_https_accepted(self):
        validate_venue_url("https://ellisebar.cz/kontakt")

    def test_empty_is_fine(self):
        validate_venue_url(None)
        validate_venue_url("")

    def test_http_rejected(self):
        with self.assertRaises(HTTPException):
            validate_venue_url("http://ellisebar.cz")

    def test_userinfo_rejected(self):
        with self.assertRaises(HTTPException):
            validate_venue_url("https://user@evil.example.com/")

    def test_invalid_venue_links_on_create_and_update(self):
        create_fields = dict(title="Concert", starts_at="2030-01-01T18:00:00Z", languages=["en"])
        for url in ("https://[bad", "https://example.org:bad", "https://example.org:99999"):
            for model, fields in ((CreateManageEvent, create_fields), (UpdateManageEvent, {})):
                with self.subTest(url=url, model=model.__name__):
                    with self.assertRaises(HTTPException) as raised:
                        model(venue_url=url, **fields)
                    self.assertEqual(raised.exception.status_code, 422)
                    self.assertEqual(raised.exception.detail, "invalid_venue_url")


class EventDetailsSchemaTest(unittest.TestCase):
    def test_defaults_and_foreign_key_for_both_initialization_paths(self):
        migration = Path(__file__).resolve().parents[2] / "migrations" / "20261109_event_details.sql"
        schema = MetaData()
        Table("events", schema, Column("id", Integer, primary_key=True))
        EventDetails.__table__.to_metadata(schema)
        for initialize_with_sql in (False, True):
            with self.subTest(initialize_with_sql=initialize_with_sql):
                engine = create_engine("sqlite://")
                self.addCleanup(engine.dispose)
                with engine.begin() as conn:
                    conn.exec_driver_sql("PRAGMA foreign_keys = ON")
                    if initialize_with_sql:
                        schema.tables["events"].create(conn)
                        conn.exec_driver_sql(migration.read_text())
                    else:
                        schema.create_all(conn)
                    with self.assertRaises(IntegrityError):
                        conn.exec_driver_sql("INSERT INTO demo_event_details (event_id) VALUES (1)")
                    conn.exec_driver_sql("INSERT INTO events (id) VALUES (1)")
                    conn.exec_driver_sql("INSERT INTO demo_event_details (event_id) VALUES (1)")
                    self.assertEqual(conn.exec_driver_sql("SELECT tags_json FROM demo_event_details").scalar_one(), "[]")
                    conn.exec_driver_sql("DELETE FROM events WHERE id = 1")
                    self.assertEqual(conn.exec_driver_sql("SELECT count(*) FROM demo_event_details").scalar_one(), 0)


class TagNormalizationTest(unittest.TestCase):
    def test_known_tags_deduplicated(self):
        self.assertEqual(normalize_tags(["Dance", "dance", " meet "]), ["dance", "meet"])

    def test_none_passthrough(self):
        self.assertIsNone(normalize_tags(None))

    def test_unknown_tag_rejected(self):
        with self.assertRaises(HTTPException):
            normalize_tags(["karaoke"])

    def test_tags_match_home_page_moods(self):
        self.assertEqual(set(EVENT_TAGS), {"meet", "friends", "listen", "dance"})


if __name__ == "__main__":
    unittest.main()
