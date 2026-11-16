"""Exercise poster replacement without starting the application or a database."""
import ast
import hashlib
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock

source = Path(__file__).resolve().parents[1] / "demo_roles.py"
function = next(n for n in ast.parse(source.read_text()).body
                if isinstance(n, ast.FunctionDef) and n.name == "poster_setup")
namespace = {"hashlib": hashlib}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), "exec"), namespace)
poster_setup = namespace["poster_setup"]

class PosterReplacementTests(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.row = SimpleNamespace(content_type="image/png", image_bytes=b"old")
        self.db.query.return_value.filter.return_value.first.return_value = self.row
        self.main = SimpleNamespace(DemoEventPoster=MagicMock(),
            decode_demo_poster=lambda data: ("image/png", data.encode()))
        self.event = SimpleNamespace(id=21, image_url="/api/gateway/demo/events/21/poster")

    def test_replacement_changes_bytes_and_url_and_same_content_is_stable(self):
        poster_setup(self.db, self.main, None, self.event, "first")
        first_url = self.event.image_url
        poster_setup(self.db, self.main, None, self.event, "second")
        self.assertEqual(self.row.image_bytes, b"second")
        self.assertNotEqual(self.event.image_url, first_url)
        self.assertTrue(self.event.image_url.startswith("/api/gateway/demo/events/21/poster?v="))
        second_url = self.event.image_url
        poster_setup(self.db, self.main, None, self.event, "second")
        self.assertEqual(self.event.image_url, second_url)
        self.db.add.assert_not_called()

    def test_initial_upload_uses_versioned_url(self):
        self.db.query.return_value.filter.return_value.first.return_value = None
        poster_setup(self.db, self.main, None, self.event, "first")
        self.db.add.assert_called_once()
        self.assertIn("?v=", self.event.image_url)

    def test_invalid_upload_preserves_old_poster(self):
        def reject(_):
            raise ValueError("invalid image")
        self.main.decode_demo_poster = reject
        with self.assertRaises(ValueError):
            poster_setup(self.db, self.main, None, self.event, "invalid")
        self.assertEqual(self.row.image_bytes, b"old")
        self.assertEqual(self.event.image_url, "/api/gateway/demo/events/21/poster")

if __name__ == "__main__":
    unittest.main()
