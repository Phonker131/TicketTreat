"""Public organizer profile validation and privacy contract (no DB required)."""
import os
import sys
import unittest
from pathlib import Path
from pydantic import ValidationError

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL","postgresql://unused:unused@127.0.0.1:5432/unused")
from demo_organizer_profiles import ProfileUpdate, public_summary


def sample(**overrides):
    values={
        "slug":"prague-events","display_name":"Prague Events",
        "bio":"We organize safe and welcoming cultural gatherings in Prague.",
        "city":"Praha","website_url":"https://example.org",
        "instagram":"prague.events","published":True,
    }
    return ProfileUpdate(**(values|overrides))


class OrganizerPublicProfileTests(unittest.TestCase):
    def test_public_profile_never_serializes_account_contacts(self):
        class Row:
            slug="prague-events"
            display_name="Prague Events"
            bio="Local organizers"
            city="Prague"
            website_url="https://example.org"
            instagram="prague_events"
            logo_type="image/png"
            cover_type="image/png"
            logo_bytes=b"png"
            cover_bytes=b"png"
            email="private@example.org"
            phone="+420000000000"
            account_id=42
        published=public_summary(Row())
        self.assertEqual(published["display_name"],"Prague Events")
        for key in ("email","phone","account_id","guest_id","attendees","ticket_id","role"):
            self.assertNotIn(key,published)
        self.assertEqual(published["logo_url"],
            "/api/gateway/demo/public/organizers/prague-events/media/logo")

    def test_accepts_published_valid_profile(self):
        self.assertTrue(sample().published)

    def test_prevents_slug_impersonation_or_unsafe_symbols(self):
        for slug in ("tickettreat","admin","official","a","hello_world",
                     "https://evil.example.org","-starts-with-hyphen"):
            with self.subTest(slug=slug),self.assertRaises(ValidationError):
                sample(slug=slug)

    def test_only_https_websites(self):
        for url in ("http://example.org","javascript:alert(1)",
                    "https://localhost","https://example.org:8080",
                    "https://user:pass@example.org"):
            with self.subTest(url=url),self.assertRaises(ValidationError):
                sample(website_url=url)

    def test_instagram_handle_not_external_url(self):
        with self.assertRaises(ValidationError):
            sample(instagram="https://example.org/inject")

    def test_empty_social_urls_are_allowed(self):
        self.assertEqual(sample(website_url="",instagram="").instagram,"")

if __name__=="__main__":
    unittest.main()
