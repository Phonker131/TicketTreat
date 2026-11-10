"""Venue link and tag validation tests; no database connection required."""
import os
import sys
import unittest
from pathlib import Path
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:5432/unused")
from demo_roles import EVENT_TAGS, normalize_tags, validate_venue_url


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
