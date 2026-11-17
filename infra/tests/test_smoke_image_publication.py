"""Image publication smoke consumes the exact new released artifact family."""

import json
import unittest

from support import load


class ImagePublicationTests(unittest.TestCase):
    def test_image_fixture_uses_the_new_published_formats_and_paths(self):
        smoke = load("smoke-images")
        files = smoke.publication_fixture()
        envelope = json.loads(files["mokly-upload.json"])
        package = json.loads((smoke.ROOT / "packages/mokly/package.json").read_bytes())
        self.assertEqual(envelope["moklyVersion"], package["version"])
        self.assertEqual(envelope["schemaVersion"], 3)
        self.assertEqual(json.loads(files[".mokly-export-artifact"])["schemaVersion"], 3)
        self.assertNotIn("comparisonPath", envelope)
        index = json.loads(files["mokly-viewer/index.json"])
        self.assertEqual(index["schemaVersion"], 9)
        self.assertRegex(index["comparisonUrl"], r"^mokly-viewer/diffs/generations/[a-f0-9]{64}/$")
        self.assertEqual(index["baseCommit"], envelope["baseSha"])
        self.assertIn("mokly-viewer/entries/start.json", files)
        self.assertIn("view/start/index.html", files)
        self.assertFalse(any(path.startswith("__mokly/") for path in files))


if __name__ == "__main__":
    unittest.main()
