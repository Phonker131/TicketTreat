"""Restore drill safety checks without connecting to any database or S3 bucket."""
import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT=Path(__file__).resolve().parents[3]/"scripts"
sys.path.insert(0,str(ROOT))
SPEC=importlib.util.spec_from_file_location("restore_drill_under_test",ROOT/"staging_restore_drill.py")
drill=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(drill)


class RestoreDrillTests(unittest.TestCase):
    def test_refuses_live_database_credentials(self):
        with patch.dict(os.environ,{"DATABASE_URL":"postgresql://private.invalid/live"}):
            with self.assertRaisesRegex(RuntimeError,"no production DATABASE_URL"):
                drill.main()

    def test_must_have_key_and_bucket(self):
        with patch.dict(os.environ,{"DATABASE_URL":"","S3_BACKUP_BUCKET":"","TT_BACKUP_KEY_HEX":""}):
            with self.assertRaisesRegex(RuntimeError,"Bucket and backup key"):
                drill.main()

    def test_latest_object_with_scoped_prefix_and_matching_extension(self):
        paginator=MagicMock()
        paginator.paginate.return_value=[
            {"Contents":[{"Key":"tickettreat/database/2026/10/01/tickettreat-1.dump.ttbk"},
                         {"Key":"tickettreat/database/2026/10/24/unrelated.txt"}]},
            {"Contents":[{"Key":"tickettreat/database/2026/10/24/tickettreat-2.dump.ttbk"}]},
        ]
        client=MagicMock()
        client.get_paginator.return_value=paginator
        fake=types.ModuleType("boto3")
        fake.client=MagicMock(return_value=client)
        with patch.dict(sys.modules,{"boto3":fake}):
            chosen=drill.newest_object("test-backups","tickettreat/database")
        self.assertEqual(chosen,"tickettreat/database/2026/10/24/tickettreat-2.dump.ttbk")
        paginator.paginate.assert_called_once_with(Bucket="test-backups",Prefix="tickettreat/database/")

if __name__=="__main__":
    unittest.main()
