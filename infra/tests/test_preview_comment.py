"""PR comment states, input validation and the one permitted credential."""

import json
from pathlib import Path
import tempfile
import unittest

from support import load


comment = load("preview-comment")
RUN = "https://github.com/mokly-ai/mokly-cloud/actions/runs/123"
SECRET = "a" * 64


class PreviewCommentTests(unittest.TestCase):
    def render(
        self,
        state,
        sign_in=None,
        project="failed",
        proof=False,
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
            if proof:
                proof_file = root / "seed-proof.json"
                proof_file.write_text('{"cookie":"must-not-appear"}')
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
            ("running", {}, "Checks running", False, False),
            ("failed", {}, "Checks failed. Open the run for details.", False, False),
            (
                "failed",
                {"sign_in": "accepted"},
                "Checks failed. Open the run for details.",
                True,
                False,
            ),
            (
                "success",
                {"sign_in": "accepted", "project": "seeded", "proof": True},
                "Checks passed",
                True,
                True,
            ),
            ("removed", {}, "Preview removed", False, False),
            (
                "cleanup-failed",
                {},
                "Cleanup failed. Rerun the workflow.",
                False,
                False,
            ),
        )
        for state, inputs, expected, open_preview, sample_project in cases:
            with self.subTest(state=state, inputs=inputs):
                body = self.render(state, **inputs)
                self.assertTrue(body.startswith("<!-- mokly-preview -->\n### Mokly preview\n"))
                self.assertIn(f"Status: **{expected}**", body)
                self.assertIn("- Commit: `" + "b" * 40 + "`", body)
                self.assertIn("- App: https://pr-42.preview.example.com/sign-in", body)
                self.assertIn("- API: https://pr-42.preview.api.example.com", body)
                self.assertIn(
                    "`https://p-<publication-id>.pr-42.preview.catalogues.net`", body
                )
                self.assertIn(f"- Workflow evidence: {RUN}", body)
                self.assertEqual("- Open preview:" in body, open_preview)
                self.assertEqual("- Sample project:" in body, sample_project)

    def test_public_repository_never_receives_the_credential_link(self):
        body = self.render(
            "success", sign_in="accepted", project="seeded", proof=True, private=False
        )
        self.assertNotIn("#secret=", body)
        self.assertIn("- Sample project:", body)
        self.assertIn(
            "https://pr-42.preview.example.com/mokly-ai/mokly/pull-requests/42", body
        )

    def test_proof_content_and_other_credentials_never_appear(self):
        body = self.render(
            "success", sign_in="accepted", project="seeded", proof=True
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
            inputs = {"sign_in": "accepted", "project": "seeded", "proof": True}
            inputs.update(changes)
            with self.subTest(state=state, changes=changes), self.assertRaises(ValueError):
                self.render(state, **inputs)
        with self.assertRaisesRegex(ValueError, "privacy"):
            self.render("failed", private="yes")


if __name__ == "__main__":
    unittest.main()
