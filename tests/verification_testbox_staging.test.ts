import assert from "node:assert/strict";
import test from "node:test";

import { runTestboxSuite } from "../scripts/verification/testbox-suite.mjs";
import type { TestboxOutcome } from "../scripts/verification/testbox-suite.mjs";

import { TESTBOX_ARGUMENTS, testboxHarness } from "./helpers/testbox_suite.js";

test("staging runs after the fingerprint and before history and suite preparation", async () => {
  const harness = testboxHarness();
  await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies);
  assert.deepEqual(harness.events, [
    "fingerprint",
    "git add -A",
    "git rev-parse --is-shallow-repository",
    "read:/repo/package-lock.json",
    `read:${harness.stamp}`,
    "cargo xtask check --executor local --suite unit --shard 1/4",
  ]);
  assert.deepEqual(harness.commands[0], {
    file: "git",
    args: ["add", "-A"],
    cwd: "/repo",
    env: harness.dependencies.environment,
    captureOutput: false,
  });
});

test("failed and signalled staging stops before reads, installs, cargo and stamp writes", async () => {
  const outcomes: TestboxOutcome[] = [
    { exitCode: 3, stdout: "", stderr: "staging failed" },
    { exitCode: null, signal: "SIGINT", stdout: "", stderr: "" },
    { exitCode: 0, interrupted: "SIGTERM", stdout: "", stderr: "" },
  ];
  for (const outcome of outcomes) {
    const harness = testboxHarness();
    harness.files.delete(harness.stamp);
    harness.outcomes.set("git add -A", outcome);
    await assert.rejects(
      runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
      { message: "Git staging failed" },
    );
    assert.deepEqual(harness.events, ["fingerprint", "git add -A"]);
    assert.deepEqual(
      harness.commands.map(({ args }) => args),
      [["add", "-A"]],
    );
    assert.deepEqual(harness.writes, []);
  }
});
