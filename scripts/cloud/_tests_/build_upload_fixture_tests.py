"""Build uploads keep the released formats and remove comparison artifacts."""

import json
from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from publication_exchange import digest
from publication_smoke_support import files_from_tar


class BuildUploadFixtureTests(unittest.TestCase):
    def fixture(self, patch=None):
        root = Path(__file__).resolve().parents[3]
        result = subprocess.run(
            [sys.executable, str(root / "scripts/cloud/build_upload_fixture.py"),
             "owner/repo", "a" * 40, "feature/build", "mokly.config.json",
             "null", json.dumps(patch or {})],
            capture_output=True, check=True,
        )
        upload = json.loads(result.stdout)
        files = files_from_tar(bytes(upload["plan"]))
        return files, upload["blobs"]

    def test_current_only_build_uses_released_upload_and_ownership_versions(self):
        files, blobs = self.fixture()
        envelope = json.loads(files["mokly-upload.json"])
        self.assertEqual(envelope["schemaVersion"], 3)
        self.assertEqual(envelope["moklyVersion"], "0.19.0")
        self.assertEqual(envelope["repository"], {"host": "github.com", "owner": "owner", "name": "repo"})
        self.assertEqual(envelope["headSha"], "a" * 40)
        self.assertEqual(envelope["branch"], "feature/build")
        self.assertNotIn("comparisonPath", envelope)
        self.assertEqual(set(files), {"mokly-upload.json", ".mokly-export-artifact", "mokly-viewer/index.json"})
        index = json.loads(files["mokly-viewer/index.json"])
        self.assertEqual(index["schemaVersion"], 9)
        self.assertEqual(index["changesStatus"], "disabled")
        self.assertIsNone(index["comparisonUrl"])
        self.assertNotIn("baseCommit", index)
        marker = json.loads(files[".mokly-export-artifact"])
        self.assertEqual(marker["schemaVersion"], 3)
        paths = {entry["path"] for entry in marker["files"]}
        self.assertIn("mokly-viewer/index.json", paths)
        self.assertFalse(any(path.startswith("mokly-viewer/diffs/") for path in paths))
        self.assertFalse(any(path.startswith("__mokly/") for path in paths))
        for entry in marker["files"]:
            data = bytes(blobs[entry["sha256"]])
            self.assertEqual(digest(data), entry["sha256"])
            self.assertEqual(len(data), entry["size"])

    def test_legacy_ownership_override_keeps_version_two_for_rejection_tests(self):
        files, _ = self.fixture({"markerVersion": 2})
        self.assertEqual(json.loads(files[".mokly-export-artifact"])["schemaVersion"], 2)

    def test_unsupported_envelope_override_keeps_the_current_ownership_version(self):
        files, _ = self.fixture({"schemaVersion": 99})
        self.assertEqual(json.loads(files["mokly-upload.json"])["schemaVersion"], 99)
        self.assertEqual(json.loads(files[".mokly-export-artifact"])["schemaVersion"], 3)


if __name__ == "__main__":
    unittest.main()
