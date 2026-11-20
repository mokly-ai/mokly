"""The Deploy wait passes only on a successful Foundation run of its own commit."""

import contextlib
import io
import json
import os
import subprocess
import unittest
from unittest.mock import patch

from support import ROOT, load


gate = load("foundation-gate")
FIXTURES = ROOT / "infra/tests/fixtures/foundation-gate"
SHA = "c" * 40
REPOSITORY = "mokly-ai/mokly-cloud"
POLLS = gate.TIMEOUT_SECONDS // gate.INTERVAL_SECONDS + 1
REGISTRATION_POLLS = gate.REGISTRATION_SECONDS // gate.INTERVAL_SECONDS + 1


def recorded(name, **changes):
    """Return the one recorded run, moved to the test commit unless overridden."""
    (entry,) = json.loads((FIXTURES / f"gh-run-list-{name}.json").read_text())
    return {**entry, "headSha": SHA, **changes}


def listed(*runs):
    return subprocess.CompletedProcess([], 0, json.dumps(list(runs)), "")


def missing_workflow():
    return subprocess.CompletedProcess(
        [], int((FIXTURES / "gh-run-list-missing-workflow.exit.txt").read_text()),
        (FIXTURES / "gh-run-list-missing-workflow.stdout.txt").read_text(),
        (FIXTURES / "gh-run-list-missing-workflow.stderr.txt").read_text(),
    )


class GhDouble:
    """Replays one gh result per poll and repeats the last one."""

    def __init__(self, *results):
        self.results = list(results)
        self.commands = []

    def __call__(self, command, **options):
        self.commands.append(command)
        return self.results[min(len(self.commands), len(self.results)) - 1]


class FoundationGateTests(unittest.TestCase):
    def wait(self, *results):
        gh = GhDouble(*results)
        sleeps = []
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            status = gate.wait(
                SHA, REPOSITORY,
                lookup=lambda sha, repository: gate.list_runs(sha, repository, run=gh),
                sleep=sleeps.append,
            )
        return status, gh.commands, sleeps, stdout.getvalue(), stderr.getvalue()

    def test_a_successful_run_passes_on_the_first_poll(self):
        status, commands, sleeps, stdout, _ = self.wait(listed(recorded("success")))
        self.assertEqual((status, len(commands), sleeps), (0, 1, []))
        self.assertIn(f"{recorded('success')['url']} succeeded for {SHA}", stdout)
        self.assertEqual(commands[0], [
            "gh", "run", "list", "--repo", REPOSITORY, "--workflow", "foundation.yml",
            "--branch", "main", "--commit", SHA, "--limit", "100", "--json", gate.FIELDS,
        ])

    def test_failed_and_cancelled_runs_fail_with_the_run_address(self):
        for name, conclusion in (("failure", "failure"), ("cancelled", "cancelled")):
            with self.subTest(name=name):
                status, commands, _, _, stderr = self.wait(listed(recorded(name)))
                self.assertEqual((status, len(commands)), (1, 1))
                self.assertIn(f"Foundation run {recorded(name)['url']} concluded {conclusion} for {SHA}.", stderr)

    def test_an_in_progress_run_is_awaited_and_never_passes(self):
        status, commands, sleeps, stdout, _ = self.wait(
            listed(recorded("in-progress")), listed(recorded("in-progress")), listed(recorded("success")))
        self.assertEqual((status, len(commands), sleeps), (0, 3, [gate.INTERVAL_SECONDS] * 2))
        self.assertIn("in_progress", stdout)
        status, commands, sleeps, _, stderr = self.wait(listed(recorded("in-progress")))
        self.assertEqual((status, len(commands), len(sleeps)), (1, POLLS, POLLS - 1))
        self.assertIn(f"The Foundation run of {SHA} did not finish within 120 minutes.", stderr)

    def test_a_later_attempt_of_the_same_run_decides(self):
        rerun = recorded("in-progress", attempt=2, number=7)
        status, commands, _, _, _ = self.wait(
            listed(rerun), listed(recorded("later-attempt", number=7)))
        self.assertEqual((status, len(commands)), (0, 2))

    def test_the_newest_run_of_the_commit_decides(self):
        older, newer = dict(number=5), dict(number=6)
        status, _, _, _, stderr = self.wait(
            listed(recorded("success", **older), recorded("failure", **newer)))
        self.assertEqual(status, 1)
        self.assertIn("concluded failure", stderr)
        status, _, _, _, _ = self.wait(listed(recorded("failure", **older), recorded("success", **newer)))
        self.assertEqual(status, 0)
        status, commands, _, _, _ = self.wait(
            listed(recorded("success", **older), recorded("in-progress", **newer)),
            listed(recorded("success", **older), recorded("success", **newer)))
        self.assertEqual((status, len(commands)), (0, 2))

    def test_a_missing_run_fails_after_the_registration_window(self):
        other_commit = recorded("success", headSha="d" * 40)
        for result in (listed(), listed(other_commit), missing_workflow()):
            with self.subTest(result=result.stdout or result.stderr):
                status, commands, sleeps, _, stderr = self.wait(result)
                self.assertEqual((status, len(commands)), (1, REGISTRATION_POLLS))
                self.assertEqual(len(sleeps), REGISTRATION_POLLS - 1)
                self.assertIn(f"No Foundation run of {SHA} appeared within 5 minutes.", stderr)
        self.assertIn("HTTP 404: workflow foundation.yml not found", stderr)

    def test_lookup_errors_are_retried(self):
        invalid = subprocess.CompletedProcess([], 0, "not json", "")
        status, commands, _, _, stderr = self.wait(missing_workflow(), invalid, listed(recorded("success")))
        self.assertEqual((status, len(commands)), (0, 3))
        self.assertIn("Could not list Foundation runs", stderr)
        unexpected = listed(dict(recorded("success"), number="7"))
        status, _, _, _, stderr = self.wait(unexpected, listed(recorded("success")))
        self.assertEqual(status, 0)
        self.assertIn("unexpected run list", stderr)

    def test_the_command_requires_the_commit_and_repository(self):
        for environment in ({"GITHUB_SHA": "main", "GITHUB_REPOSITORY": REPOSITORY},
                            {"GITHUB_SHA": SHA, "GITHUB_REPOSITORY": ""}):
            with self.subTest(environment=environment), patch.dict(os.environ, environment), \
                    patch.object(gate, "wait") as waited, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(gate.main(), 1)
                waited.assert_not_called()


if __name__ == "__main__":
    unittest.main()
