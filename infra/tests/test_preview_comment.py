"""PR comment states, input validation and the one permitted credential."""

import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from support import load


comment = load("preview-comment")
RUN = "https://github.com/mokly-ai/mokly-cloud/actions/runs/123"
SECRET = "a" * 64
PROOF = '{"publicationId":"0b7c2c1e-4a59-4f0e-9a52-3d1e0c6f8a11","cookie":"must-not-appear"}'
PATTERN = "- Catalogue: `https://p-<publication-id>.pr-42.preview.catalogues.net`"
PUBLISHED = "- Catalogue: https://p-0b7c2c1e-4a59-4f0e-9a52-3d1e0c6f8a11.pr-42.preview.catalogues.net/"


class PreviewCommentTests(unittest.TestCase):
    def render(
        self,
        state,
        sign_in=None,
        project="failed",
        proof=None,
        private=True,
        **changes,
    ):
        inputs = dict(
            environment="preview-pr-42",
            revision="b" * 40,
            domain="example.com",
            catalogue="catalogues.net",
            run_url=RUN,
        )
        inputs.update(changes)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            secret_file = None
            status_file = None
            proof_file = None
            if sign_in is not None:
                secret_file = root / "preview-sign-in"
                secret_file.write_text(SECRET)
                secret_file.chmod(0o600)
                status_file = root / "seed-status.json"
                status_file.write_text(
                    json.dumps(
                        {
                            "schemaVersion": 1,
                            "environment": inputs["environment"],
                            "revision": inputs["revision"],
                            "signIn": sign_in,
                            "project": project,
                            "checkedAt": "2026-09-27T12:00:00Z",
                        }
                    )
                )
            if proof is not None:
                proof_file = root / "seed-proof.json"
                proof_file.write_text(proof)
            return comment.comment(
                state,
                inputs["environment"],
                inputs["revision"],
                inputs["domain"],
                inputs["catalogue"],
                inputs["run_url"],
                private,
                secret_file,
                status_file,
                proof_file,
            )

    def test_every_outcome_row_selects_its_exact_links(self):
        cases = (
            ("running", {}, "Checks running", False, False, PATTERN),
            ("failed", {}, "Checks failed. Open the run for details.", False, False, PATTERN),
            (
                "failed",
                {"sign_in": "accepted", "proof": PROOF},
                "Checks failed. Open the run for details.",
                True,
                False,
                PATTERN,
            ),
            (
                "success",
                {"sign_in": "accepted", "project": "seeded", "proof": PROOF},
                "Checks passed",
                True,
                True,
                PUBLISHED,
            ),
            ("removed", {}, "Preview removed", False, False, PATTERN),
            (
                "cleanup-failed",
                {},
                "Cleanup failed. Rerun the workflow.",
                False,
                False,
                PATTERN,
            ),
        )
        for state, inputs, expected, open_preview, sample_project, catalogue in cases:
            with self.subTest(state=state, inputs=inputs), contextlib.redirect_stderr(io.StringIO()) as errors:
                body = self.render(state, **inputs)
                self.assertEqual(errors.getvalue(), "")
                self.assertTrue(body.startswith("<!-- mokly-preview -->\n### Mokly preview\n"))
                self.assertIn(f"Status: **{expected}**", body)
                self.assertIn("- Commit: `" + "b" * 40 + "`", body)
                self.assertIn("- App: https://pr-42.preview.example.com/sign-in", body)
                self.assertIn("- API: https://pr-42.preview.api.example.com", body)
                self.assertEqual(
                    [line for line in body.splitlines() if line.startswith("- Catalogue:")],
                    [catalogue],
                )
                self.assertIn(f"- Workflow evidence: {RUN}", body)
                self.assertEqual("- Open preview:" in body, open_preview)
                self.assertEqual("- Sample project:" in body, sample_project)

    def test_success_uses_catalogue_pattern_and_warns_for_invalid_proof(self):
        kept = "; the Catalogue line keeps its pattern\n"
        invalid_id = "Preview comment: warning: seed proof publication ID is not a canonical UUID" + kept
        cases = (
            ("{", "Preview comment: warning: seed-proof.json is not a readable JSON object" + kept),
            ('{"cookie":"must-not-appear"}', invalid_id),
            ('{"publicationId":"0B7C2C1E-4A59-4F0E-9A52-3D1E0C6F8A11"}', invalid_id),
        )
        for proof, warning in cases:
            with self.subTest(proof=proof), contextlib.redirect_stderr(io.StringIO()) as errors:
                body = self.render(
                    "success", sign_in="accepted", project="seeded", proof=proof
                )
                self.assertIn(PATTERN, body.splitlines())
                self.assertEqual(errors.getvalue(), warning)

    def test_public_repository_never_receives_the_credential_link(self):
        body = self.render(
            "success", sign_in="accepted", project="seeded", proof=PROOF, private=False
        )
        self.assertNotIn("#secret=", body)
        self.assertIn("- Sample project:", body)
        self.assertIn(
            "https://pr-42.preview.example.com/mokly-ai/mokly/pull-requests/42", body
        )

    def test_proof_content_and_other_credentials_never_appear(self):
        body = self.render(
            "success", sign_in="accepted", project="seeded", proof=PROOF
        )
        self.assertEqual(body.count(SECRET), 1)
        for forbidden in ("must-not-appear", "csrf", "mkc_session", "mkc_"):
            self.assertNotIn(forbidden, body)

    def test_invalid_inputs_never_render(self):
        for state, changes in (
            ("invalid", {}),
            ("success", {"environment": "production"}),
            ("success", {"environment": "preview-pr-0"}),
            ("success", {"revision": "a" * 39}),
            ("success", {"revision": "A" * 40}),
            ("success", {"domain": "example"}),
            ("success", {"catalogue": "catalogues.net/#token=secret"}),
            ("success", {"run_url": "https://attacker.example/actions/runs/123"}),
            ("success", {"run_url": RUN + "#token=secret"}),
        ):
            inputs = {"sign_in": "accepted", "project": "seeded", "proof": PROOF}
            inputs.update(changes)
            with self.subTest(state=state, changes=changes), self.assertRaises(ValueError):
                self.render(state, **inputs)
        with self.assertRaisesRegex(ValueError, "privacy"):
            self.render("failed", private="yes")


if __name__ == "__main__":
    unittest.main()
