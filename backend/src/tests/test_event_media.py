"""Media validation tests; no database connection required."""
import os
import sys
import unittest
from pathlib import Path
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql://unused:unused@127.0.0.1:5432/unused")
from demo_roles import validate_media_urls


class MediaValidationTest(unittest.TestCase):
    def test_valid(self):
        validate_media_urls(["https://cdn.example.com/1.jpg"], "https://youtu.be/abc123")

    def test_insecure_photo_rejected(self):
        with self.assertRaises(HTTPException):
            validate_media_urls(["http://cdn.example.com/photo.jpg"], None)

    def test_video_provider_restricted(self):
        with self.assertRaises(HTTPException):
            validate_media_urls([], "https://malicious.example.com/play")

    def test_too_many_images_rejected(self):
        with self.assertRaises(HTTPException):
            validate_media_urls(["https://example.com/%d.jpg" % i for i in range(9)], None)


if __name__ == "__main__":
    unittest.main()
