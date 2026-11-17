"""Catalogue capture validates workflow identity and the exact CLI exchange."""

import hashlib
import json
from pathlib import Path
import random
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from catalogue_capture_support import (
    FIXTURES,
    GZIP_CHUNK_BYTES,
    CaptureHarness,
    EofGuard,
    pad_gzip_to_chunk_boundary,
)
from support import load


PROMPT_REJECTION_SECONDS = 5
plan_module = load("catalogue_capture_plan")


class CatalogueCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.capture = CaptureHarness(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def test_success_stores_the_exact_plan_and_verified_blobs(self):
        export = self.capture.export(self.capture.envelope())
        plan = self.capture.plan(export)
        result = self.capture.run(export, plan)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            (self.capture.output / "plan.tar.gz").read_bytes(), plan.read_bytes()
        )
        expected = self.capture.expected_blobs(export)
        self.assertEqual(len(expected), 2)
        self.assertEqual(self.capture.stored_blobs(), expected)
        for digest in expected:
            data = (self.capture.output / "blobs" / digest).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), digest)
        self.assertEqual(self.capture.npm_calls.read_text(), "--prefix ts ci\n")
        self.assertTrue(
            result.stdout.startswith(
                (FIXTURES / "mokly-publish-success.stdout.txt").read_text()
            )
        )
        self.assertIn("Captured catalogue: 5 files, 2 blobs,", result.stdout)
        self.assertEqual(
            result.stderr,
            (FIXTURES / "mokly-publish-success.stderr.txt").read_text(),
        )
        observed = self.capture.observed()
        for key in ["temporary", "cache"]:
            path = Path(observed[key])
            self.assertTrue(path.is_absolute(), observed)
            self.assertNotIn(self.capture.checkout, path.parents)
            self.assertFalse(path.exists(), "capture must remove its private runtime")
        self.assertEqual(
            observed["arguments"],
            [
                "publish",
                "--strict",
                "--config",
                "mokly.config.json",
                "--repository",
                "github.com/mokly-ai/mokly-cloud",
                "--endpoint",
                observed["arguments"][7],
            ],
        )
        self.assertRegex(
            observed["arguments"][7], r"^http://127[.]0[.]0[.]1:[1-9][0-9]*/$"
        )
        self.assertNotIn("Capture timings: ", result.stdout)
        self.assertNotIn("[mokly:timing] ", result.stderr)
        self.assertEqual(observed["githubActions"], "true")
        self.assertEqual(observed["headRef"], "feature/catalogue")
        self.assertEqual(observed["ref"], "refs/pull/42/head")
        self.assertEqual(observed["statuses"], [200, 204, 204, 201])

    def test_cli_failure_is_propagated_without_a_stale_capture(self):
        export = self.capture.export(self.capture.envelope())
        (self.capture.output / "blobs").mkdir(parents=True)
        (self.capture.output / "plan.tar.gz").write_bytes(b"stale")
        result = self.capture.run(export, mode="failure")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn(
            (FIXTURES / "mokly-publish-failure.stderr.txt").read_text(),
            result.stderr,
        )
        self.assertIn("mokly publish failed with exit 1", result.stderr)
        self.assertFalse(self.capture.output.exists())
        for key in ["temporary", "cache"]:
            self.assertFalse(Path(self.capture.observed()[key]).exists())

    def test_dirty_checkout_failure_creates_no_receiver_request(self):
        export = self.capture.export(self.capture.envelope())
        for mode in ["git-uncommitted"]:
            with self.subTest(mode=mode):
                result = self.capture.run(export, mode=mode)
                expected_exit = int((FIXTURES / f"mokly-publish-{mode}.exit.txt").read_text())
                self.assertEqual(result.returncode, expected_exit)
                self.assertEqual(result.stdout, (FIXTURES / f"mokly-publish-{mode}.stdout.txt").read_text())
                self.assertEqual(result.stderr, (FIXTURES / f"mokly-publish-{mode}.stderr.txt").read_text()
                                 + f"Catalogue capture failed: mokly publish failed with exit {expected_exit}\n")
                self.assertEqual(self.capture.observed()["statuses"], [])
                self.assertFalse(self.capture.output.exists())

    def test_capture_checks_the_envelope_version_explicitly(self):
        capture = load("capture-catalogue")
        expected = capture.CaptureSettings(self.capture.checkout, self.capture.revision,
                                          "feature/catalogue", 42, self.capture.revision)
        for version in [1, 2, "3", 3.0, True, None]:
            with self.subTest(version=version), self.assertRaisesRegex(capture.CaptureError, "schemaVersion"):
                capture.require_envelope(self.capture.envelope(schemaVersion=version), expected)

    def test_incomplete_and_refused_exchanges_fail(self):
        cases = {
            "missing": ([], "did not receive an upload plan"),
            "no-complete": ([200, 204, 204], "did not receive the upload completion"),
            "second-plan": ([200, 204, 204, 201, 409], "refused a second upload plan"),
            "unexpected-request": ([200, 204, 204, 405, 201], "unexpected request"),
            "early-complete": ([200, 409], "completion before every missing blob"),
            "unknown-blob": ([200, 204, 204, 404, 201], "blob outside the upload plan"),
            "wrong-hash": ([200, 400, 204, 409], "blob that does not match its hash"),
            "wrong-length": ([200, 400, 204, 409], "blob of the wrong length"),
        }
        export = self.capture.export(self.capture.envelope())
        for mode, (statuses, message) in cases.items():
            with self.subTest(mode=mode):
                result = self.capture.run(export, mode=mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue(
                    result.stderr.endswith(message + "\n"), result.stderr
                )
                self.assertIn("Catalogue capture failed: capture receiver", result.stderr)
                self.assertEqual(self.capture.observed()["statuses"], statuses)
                self.assertFalse(self.capture.output.exists())
                self.assertEqual(
                    list(self.capture.output.parent.iterdir()), []
                )

    def test_repeated_hash_is_accepted_once(self):
        export = self.capture.export(self.capture.envelope())
        result = self.capture.run(export, mode="repeated-hash")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.capture.observed()["statuses"], [200, 204, 204, 204, 201])
        self.assertEqual(
            self.capture.stored_blobs(), self.capture.expected_blobs(export)
        )

    def test_plans_over_the_blob_limits_are_refused(self):
        count = [
            ("bulk/%05d.html" % index, hashlib.sha256(b"%d" % index).hexdigest(), 1)
            for index in range(20_000)
        ]
        size = [
            ("bulk/%d.bin" % index, hashlib.sha256(b"%d" % index).hexdigest(), 64 << 20)
            for index in range(9)
        ]
        cases = (
            (count, "catalogue upload declares more than 19,999 blobs"),
            (size, "catalogue upload declares more than 512 MiB of blobs"),
        )
        for declared, message in cases:
            with self.subTest(message=message):
                export = self.capture.export(self.capture.envelope(), declared=declared)
                result = self.capture.run(export)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(
                    (FIXTURES / "mokly-publish-too-large.stderr.txt").read_text(),
                    result.stderr,
                )
                self.assertTrue(
                    result.stderr.endswith(f"Catalogue capture failed: {message}\n"),
                    result.stderr,
                )
                self.assertEqual(self.capture.observed()["statuses"], [413])
                self.assertFalse(self.capture.output.exists())

    def assert_prompt_gzip_rejection(self, export, plan):
        try:
            result = self.capture.run(export, plan, timeout=PROMPT_REJECTION_SECONDS)
        except subprocess.TimeoutExpired:
            self.fail(
                f"catalogue capture did not reject gzip data within "
                f"{PROMPT_REJECTION_SECONDS} seconds"
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(
            result.stderr.endswith(
                "Catalogue capture failed: catalogue upload is not a valid "
                "gzip archive\n"
            ),
            result.stderr,
        )
        self.assertEqual(self.capture.observed()["statuses"], [400])
        self.assertFalse(self.capture.output.exists())

    def test_gzip_truncation_fails(self):
        export = self.capture.export(self.capture.envelope())
        archive = self.capture.plan(export).read_bytes()
        plan = self.capture.root / "truncated.tar.gz"
        plan.write_bytes(archive[:-8])
        self.assert_prompt_gzip_rejection(export, plan)

    def test_large_gzip_rejects_same_chunk_suffixes_promptly(self):
        index = random.Random(0).randbytes(2 * GZIP_CHUNK_BYTES) + bytes(
            2 * GZIP_CHUNK_BYTES
        )
        export = self.capture.export(self.capture.envelope(), index=index)
        archive = self.capture.plan(export).read_bytes()
        self.assertNotEqual(len(archive) % GZIP_CHUNK_BYTES, 0)
        for name, contents in {
            "extra-member": archive + archive,
            "trailing-bytes": archive + b"not-a-gzip-member",
        }.items():
            with self.subTest(name=name):
                plan = self.capture.root / f"{name}.tar.gz"
                plan.write_bytes(contents)
                self.assert_prompt_gzip_rejection(export, plan)

    def test_gzip_rejects_bytes_after_an_exact_chunk_boundary_promptly(self):
        index = random.Random(1).randbytes(GZIP_CHUNK_BYTES - 32 * 1024)
        export = self.capture.export(self.capture.envelope(), index=index)
        boundary_member = pad_gzip_to_chunk_boundary(
            self.capture.plan(export).read_bytes()
        )
        self.assertEqual(len(boundary_member) % GZIP_CHUNK_BYTES, 0)
        plan = self.capture.root / "boundary-trailing-bytes.tar.gz"
        plan.write_bytes(boundary_member + b"later-file-bytes")
        self.assert_prompt_gzip_rejection(export, plan)

        decompressobj = plan_module.zlib.decompressobj

        def guarded_decompressor(wbits):
            return EofGuard(decompressobj(wbits))

        with patch.object(plan_module.zlib, "decompressobj", guarded_decompressor):
            with self.assertRaises(plan_module.PlanError):
                plan_module.validate_gzip(plan)

    def test_every_mismatched_envelope_field_fails(self):
        cases = {
            "repository": {"host": "github.com", "owner": "other", "name": "repo"},
            "branch": "other",
            "headSha": "b" * 40,
            "pullRequest": 43,
            "configPath": "other.config.json",
            "baseRef": "main",
            "baseSha": "b" * 40,
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                key = field
                export = self.capture.export(self.capture.envelope(**{key: value}))
                result = self.capture.run(export)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(key, result.stderr)
                self.assertEqual(self.capture.observed()["statuses"][0], 200)
                self.assertEqual(self.capture.observed()["statuses"][-1], 201)
                self.assertFalse(self.capture.output.exists())

    def test_invalid_pr_number_branch_and_revision_fail_before_install(self):
        export = self.capture.export(self.capture.envelope())
        cases = (
            {"environment": "preview-pr-0"},
            {"branch": "bad\nbranch"},
            {"branch": "é" * 128},
            {"revision": "A" * 40},
            {"revision": "b" * 40},
        )
        for changes in cases:
            with self.subTest(changes=changes):
                result = self.capture.run(export, **changes)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(self.capture.npm_calls.exists())
                self.assertFalse(self.capture.output.exists())


if __name__ == "__main__":
    unittest.main()
