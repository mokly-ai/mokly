"""The seed Job validates release inputs and existing evidence before cloud use."""

import json
import tempfile
import unittest

from preview_seed_job_support import SeedJobDouble


class PreviewSeedJobInputTests(unittest.TestCase):
    def test_invalid_run_configuration_and_catalogue_fail_before_provider_calls(self):
        cases = (
            (["--run", "../other"], {}, "run must match"),
            (["--run", "123-2"], {"MKC_REVISION": "bad"}, "MKC_REVISION"),
            (["--run", "123-2"], {"MKC_PREVIEW_BLOBS_BUCKET": "other"}, "MKC_PREVIEW_BLOBS_BUCKET"),
            (["--run", "123-2", "--catalogue", "missing"], {}, "catalogue"),
        )
        for arguments, variables, diagnostic in cases:
            with self.subTest(arguments=arguments, variables=variables), tempfile.TemporaryDirectory() as directory:
                commands = SeedJobDouble(directory)
                result = commands.run_seed(arguments, **variables)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn("Preview seed failed:", result.stderr)
                self.assertIn(diagnostic, result.stderr)
                self.assertEqual(commands.calls(), "")
                self.assertNotIn("Traceback", result.stderr)

    def test_evidence_validation_uses_the_existing_revision_and_proof_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = SeedJobDouble(directory)
            commands.write_evidence()
            self.assertEqual(commands.run_seed(["--validate-evidence"]).returncode, 0)
            proof_path = commands.context / "seed-proof.json"
            proof = json.loads(proof_path.read_text())
            for field, value in (("revision", "b" * 40), ("viewerUrl", "https://elsewhere.example/"), ("publicationId", "invalid"), ("projectSlug", "mokly-cloud")):
                with self.subTest(field=field):
                    proof_path.write_text(json.dumps(dict(proof, **{field: value})))
                    result = commands.run_seed(["--validate-evidence"])
                    self.assertEqual(result.returncode, 1, result.stderr)
                    self.assertTrue(result.stderr.startswith("Preview seed failed:"))
            self.assertEqual(commands.calls(), "")


if __name__ == "__main__":
    unittest.main()
