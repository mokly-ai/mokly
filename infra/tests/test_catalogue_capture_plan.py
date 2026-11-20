"""The capture Plan reader uses envelope 3, marker 3 and required index 9."""

import json
from pathlib import Path
import tempfile
import unittest

import support
from catalogue_capture_plan import PlanError, PlanTooLarge, missing_blobs, read_plan
from test_catalogue_capture_receiver import ENVELOPE, INDEX, digest, export_files, marker_bytes, plan_archive


class PlanReadingTests(unittest.TestCase):
    def read(self, archive):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "plan.tar.gz"
            path.write_bytes(archive)
            return read_plan(path)

    def test_missing_blob_limits_are_inclusive(self):
        many = [(str(index), digest(b"%d" % index), 1) for index in range(20_000)]
        self.assertEqual(len(missing_blobs(many[:19_999], set())), 19_999)
        with self.assertRaisesRegex(PlanTooLarge, "19,999 blobs"):
            missing_blobs(many, set())
        full = [(str(index), digest(b"%d" % index), 64 << 20) for index in range(8)]
        self.assertEqual(sum(missing_blobs(full, set()).values()), 512 << 20)
        with self.assertRaisesRegex(PlanTooLarge, "512 MiB"):
            missing_blobs(full + [("extra", digest(b"extra"), 1)], set())

    def test_artifact_hashes_are_never_missing_even_when_shared(self):
        files = export_files()
        files["view/index-copy.json"] = files[INDEX]
        plan = self.read(plan_archive(files))
        self.assertEqual(plan.files, 5)
        self.assertNotIn(digest(files[INDEX]), plan.missing)
        self.assertNotIn("comparisonPath", plan.envelope)
        self.assertEqual(plan.envelope["schemaVersion"], 3)

    def test_envelope_versions_are_checked_before_marker_fields(self):
        for version in [1, 2, "3", 3.0, True, None]:
            files = export_files()
            envelope = json.loads(files[ENVELOPE])
            envelope["schemaVersion"] = version
            files[ENVELOPE] = json.dumps(envelope).encode()
            with self.subTest(version=version), self.assertRaisesRegex(PlanError, "envelope must be schema 3"):
                self.read(plan_archive(files, b"{}"))

    def test_required_index_requires_schema_9(self):
        for version in [5, 8, "9", 9.0, True, None]:
            files = export_files()
            index = json.loads(files[INDEX])
            index["schemaVersion"] = version
            files[INDEX] = json.dumps(index).encode()
            with self.subTest(version=version), self.assertRaisesRegex(PlanError, "index must be schema 9"):
                self.read(plan_archive(files))

    def test_required_index_requires_a_json_object(self):
        files = export_files()
        for index in [b"[]", b"not json"]:
            with self.subTest(index=index), self.assertRaisesRegex(PlanError, "is not a JSON object"):
                self.read(plan_archive(dict(files, **{INDEX: index})))

    def test_marker_and_namespace_violations_are_refused(self):
        files = export_files()
        wrong = dict(files, **{ENVELOPE: b"{}"})
        marker = json.loads(marker_bytes(files))
        cases = {
            "declare the archived envelope": plan_archive(files, marker_bytes(wrong)),
            "only its envelope, marker and index": plan_archive(
                files, extra=[("index.html", b"<main>")]
            ),
            "must be schema 3": plan_archive(
                files, json.dumps(dict(marker, schemaVersion="3")).encode()
            ),
            "marker is invalid": plan_archive(
                files,
                json.dumps(dict(marker, files=[dict(marker["files"][0], size="1")])).encode(),
            ),
            "one hash with two sizes": plan_archive(
                files,
                json.dumps(
                    dict(marker, files=marker["files"] + [dict(marker["files"][0], path="x", size=0)])
                ).encode(),
            ),
        }
        for message, archive in cases.items():
            with self.subTest(message=message), self.assertRaisesRegex(PlanError, message):
                self.read(archive)


if __name__ == "__main__":
    unittest.main()
