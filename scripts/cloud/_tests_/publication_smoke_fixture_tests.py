"""Source-only fixture revisions validate before publication."""

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication_smoke_fixture as fixture
from publication_smoke_consumer import PublishedCli


ROOT = Path(__file__).resolve().parents[3]


class SmokeFixtureTests(unittest.TestCase):
    def test_real_cli_builds_both_revisions_from_source_only(self):
        fixture.require_dependencies(ROOT)
        context = ROOT / ".context"
        context.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="source-baseline-test-", dir=context) as directory:
            checkout = fixture._prepare_isolated_checkout(ROOT, Path(directory), PublishedCli(
                ROOT, ROOT / "packages/mokly/bin/mokly.mjs",
                json.loads((ROOT / "packages/mokly/package.json").read_bytes())["version"]))
            self.assertEqual(fixture._git(checkout, "rev-list", "--count", "HEAD").strip(), b"2")
            for revision, heading in [("HEAD~1", b"Ready to review"), ("HEAD", b"Ready to publish")]:
                self.assertIn(heading, fixture._git(checkout, "show", revision + ":" + fixture.FIXTURE_ENTRY.as_posix()))
                paths = fixture._git(checkout, "ls-tree", "-r", "--name-only", revision).decode().splitlines()
                self.assertFalse(any("mokly-generated/" in path or ".context/" in path or "node_modules" in path for path in paths))
                self.assertIn("mokly.config.json", paths)
            built = checkout / ".context/validation"
            self.assertIn(b"Ready to publish", (built / "static/mokly-generated/publication-smoke/index.desktop.html").read_bytes())
            self.assertEqual(json.loads((built / "mokly-viewer/index.json").read_bytes())["schemaVersion"], 9)
            self.assertEqual(fixture._git(checkout, "status", "--porcelain", "--untracked-files=all"), b"")

    def test_first_build_failure_stops_before_commit_or_source_change(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / fixture.PUBLISHED_CLI_FIXTURE
            source.mkdir(parents=True)
            (source / "README.md").write_text("baseline\n")
            with patch.object(fixture, "_git", return_value=b"origin"), patch.object(
                fixture, "_link_dependencies"
            ), patch.object(fixture, "_build_fixture", side_effect=AssertionError("baseline build failure")), patch.object(
                fixture, "_commit_fixture"
            ) as commit, patch.object(fixture, "_change_fixture") as change:
                with self.assertRaisesRegex(AssertionError, "^baseline build failure$"):
                    fixture._prepare_isolated_checkout(root, root / "workspace", PublishedCli(root, root / "consumer/bin/mokly", "9.8.7"))
                commit.assert_not_called()
                change.assert_not_called()

    def test_each_revision_has_strict_validation_before_its_commit(self):
        events = []
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / fixture.PUBLISHED_CLI_FIXTURE
            source.mkdir(parents=True)
            with patch.object(fixture, "_git", side_effect=lambda _, *args: b"origin" if args == ("remote", "get-url", "origin") else b""), patch.object(
                fixture, "_link_dependencies"
            ), patch.object(fixture, "_build_fixture", side_effect=lambda _, _cli: events.append("build")), patch.object(
                fixture, "_commit_fixture", side_effect=lambda _, message: events.append(message)
            ), patch.object(fixture, "_change_fixture", side_effect=lambda _: events.append("change")):
                fixture._prepare_isolated_checkout(root, root / "workspace", PublishedCli(root, root / "consumer/bin/mokly", "9.8.7"))
        self.assertEqual(events, ["build", "fixture baseline", "change", "build", "fixture comparison"])

    def test_build_uses_supplied_strict_cli_and_reports_complete_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory) / "checkout"
            checkout.mkdir()
            result = subprocess.CompletedProcess([], 1, "build stdout\n", "build stderr\n")
            with patch.object(fixture.subprocess, "run", return_value=result) as run:
                with self.assertRaises(AssertionError) as failure:
                    fixture._build_fixture(checkout, PublishedCli(checkout, checkout / "consumer/bin/mokly", "9.8.7"))
                self.assertEqual(run.call_args.args[0], [str(checkout / "consumer/bin/mokly"),
                    "build", "--strict", "--config", "mokly.config.json", "--out",
                    str(checkout / ".context/validation"), "--no-changes"])
                self.assertEqual(run.call_args.kwargs["cwd"], checkout)
                self.assertEqual(str(failure.exception), "Published CLI fixture build failed:\nexit 1\nstdout:\nbuild stdout\n\nstderr:\nbuild stderr\n")

    def test_published_cli_checkout_uses_frozen_fixture_not_live_catalogue(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / fixture.PUBLISHED_CLI_FIXTURE
            shutil.copytree(ROOT / fixture.PUBLISHED_CLI_FIXTURE, source)
            (root / "live-catalogue.txt").write_text("must not be copied\n")
            (root / "mokly.config.json").write_text("live config\n")
            stale = source / "catalogue/mokly-generated/stale.html"
            stale.parent.mkdir(parents=True)
            stale.write_text("local output must not be copied\n")
            dependencies = root / "node_modules/react"
            dependencies.mkdir(parents=True)
            original_git = fixture._git

            def git(checkout, *arguments):
                if checkout == root:
                    return b"https://github.com/mokly-ai/mokly-cloud\n"
                return original_git(checkout, *arguments)

            with patch.object(fixture, "_git", side_effect=git), patch.object(fixture, "_build_fixture") as builds:
                checkout = fixture._prepare_isolated_checkout(root, root / "workspace", PublishedCli(root, root / "consumer/bin/mokly", "9.8.7"))
            self.assertEqual(builds.call_count, 2)
            self.assertEqual((checkout / "mokly.config.json").read_bytes(), (source / "mokly.config.json").read_bytes())
            self.assertFalse((checkout / "live-catalogue.txt").exists())
            self.assertFalse((checkout / "catalogue/mokly-generated").exists())
            self.assertIn("Ready to publish", (checkout / fixture.FIXTURE_ENTRY).read_text())
            self.assertEqual(fixture._git(checkout, "status", "--porcelain", "--untracked-files=all"), b"")
            self.assertEqual((checkout / "node_modules/react").resolve(), dependencies.resolve())
            self.assertEqual(fixture._git(checkout, "remote", "get-url", "origin").strip(), b"https://github.com/mokly-ai/mokly-cloud")


if __name__ == "__main__":
    unittest.main()
