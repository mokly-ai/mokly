"""Shared path limit and ownership in the index smoke."""

import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import viewer_index_smoke as viewer_smoke
from publication_exchange import ENVELOPE, MARKER, with_marker


class ViewerIndexSmokeTests(unittest.TestCase):
    def test_the_live_smoke_reads_the_shared_entry_path_limit(self):
        self.assertEqual(viewer_smoke.share_path_limit(), 2048)

    def test_new_ownership_markers_are_schema_three(self):
        files = with_marker({ENVELOPE: b'{"schemaVersion":3}', "index.html": b"<main>"})
        marker = json.loads(files[MARKER])
        self.assertEqual(marker["schemaVersion"], 3)
        self.assertEqual({row["path"] for row in marker["files"]}, {ENVELOPE, "index.html"})


if __name__ == "__main__":
    unittest.main()
