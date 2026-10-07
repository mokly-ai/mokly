import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runTestboxSuite } from "../scripts/verification/testbox-suite.mjs";

import { TESTBOX_ARGUMENTS, testboxHarness } from "./helpers/testbox_suite.js";

test("every failed preparation command stops before cargo and stamp updates", async () => {
  for (const failure of [
    "git rev-parse --is-shallow-repository",
    "git fetch --unshallow --tags origin",
    "npm ci",
    "npx playwright install chromium",
  ]) {
    const harness = testboxHarness();
    harness.files.delete(harness.stamp);
    harness.outcomes.set("git rev-parse --is-shallow-repository", {
      exitCode: 0,
      stdout: "true\n",
      stderr: "",
    });
    harness.outcomes.set(failure, {
      exitCode: 3,
      stdout: "",
      stderr: "failure",
    });
    await assert.rejects(
      runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
      /failed/u,
    );
    assert.equal(
      harness.commands.some(({ file }) => file === "cargo"),
      false,
    );
    assert.deepEqual(harness.writes, []);
  }
});

test("read, write and fingerprint failures cannot start cargo", async () => {
  for (const step of ["fingerprint", "lockfile", "stamp", "write"]) {
    const harness = testboxHarness();
    if (step === "fingerprint")
      harness.dependencies.readFingerprint = async () => {
        throw new Error("read failed");
      };
    if (step === "lockfile")
      harness.files.delete(path.join("/repo", "package-lock.json"));
    if (step === "stamp")
      harness.dependencies.readFile = async (file) => {
        if (file === harness.stamp)
          throw Object.assign(new Error("access denied"), { code: "EACCES" });
        return Buffer.from("lockfile bytes");
      };
    if (step === "write") {
      harness.files.delete(harness.stamp);
      harness.dependencies.writeFile = async () => {
        throw new Error("write failed");
      };
    }
    await assert.rejects(
      runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    );
    assert.equal(
      harness.commands.some(({ file }) => file === "cargo"),
      false,
    );
  }
});

test("invalid shallow output and missing HOME fail instead of guessing", async () => {
  const harness = testboxHarness();
  harness.outcomes.set("git rev-parse --is-shallow-repository", {
    exitCode: 0,
    stdout: "unknown",
    stderr: "",
  });
  await assert.rejects(
    runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    /shallow/u,
  );
  delete harness.dependencies.environment.HOME;
  await assert.rejects(
    runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    /HOME/u,
  );
});

test("signals and interrupted commands cannot turn into success", async () => {
  for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    const harness = testboxHarness();
    harness.outcomes.set(
      "cargo xtask check --executor local --suite unit --shard 1/4",
      {
        exitCode: null,
        signal,
        stdout: "",
        stderr: "",
      },
    );
    assert.equal(
      await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
      code,
    );
    harness.outcomes.set(
      "cargo xtask check --executor local --suite unit --shard 1/4",
      {
        exitCode: 0,
        interrupted: signal,
        stdout: "",
        stderr: "",
      },
    );
    assert.equal(
      await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
      code,
    );
    harness.outcomes.set("git rev-parse --is-shallow-repository", {
      exitCode: 0,
      interrupted: signal,
      stdout: "false\n",
      stderr: "",
    });
    await assert.rejects(
      runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
      /failed/u,
    );
  }
});
