import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  parseTestboxArguments,
  runTestboxSuite,
} from "../scripts/verification/testbox-suite.mjs";

import {
  TESTBOX_ARGUMENTS,
  TESTBOX_FINGERPRINT,
  testboxHarness,
} from "./helpers/testbox_suite.js";

const commands = [
  { suite: "repository", name: "repository", shard: undefined },
  { suite: "viewer", name: "viewer", shard: undefined },
  ...[1, 2, 3, 4].map((index) => ({
    suite: "browser",
    name: `browser-${index}-of-4`,
    shard: `${index}/4`,
  })),
];

test("six commands derive exact cargo arguments, report names and streamed output", async () => {
  for (const { suite, name, shard } of commands) {
    const harness = testboxHarness();
    const args = ["--expect", TESTBOX_FINGERPRINT, "--suite", suite];
    if (shard) args.push("--shard", shard);
    assert.equal(parseTestboxArguments(args).commandName, name);
    assert.equal(await runTestboxSuite(args, harness.dependencies), 0);
    assert.deepEqual(
      harness.commands.map(({ file, args, captureOutput }) => ({
        file,
        args,
        captureOutput,
      })),
      [
        { file: "git", args: ["add", "-A"], captureOutput: false },
        {
          file: "git",
          args: ["rev-parse", "--is-shallow-repository"],
          captureOutput: true,
        },
        ...(suite === "viewer"
          ? [
              {
                file: "npm",
                args: [
                  "install",
                  "--global",
                  "--prefix",
                  harness.bunPrefix,
                  "bun@1.8.2",
                ],
                captureOutput: false,
              },
            ]
          : []),
        {
          file: "cargo",
          args: [
            "xtask",
            "check",
            "--executor",
            "local",
            "--suite",
            suite,
            ...(shard ? ["--shard", shard] : []),
          ],
          captureOutput: false,
        },
      ],
    );
    const cargo = harness.commands.find((command) => command.file === "cargo")!;
    assert.equal(cargo.cwd, "/repo");
    assert.equal(
      cargo.env.MOKLY_VERIFICATION_REPORT,
      `.context/verification-reports/remote/${name}.json`,
    );
    assert.equal(
      cargo.env.PATH,
      suite === "viewer"
        ? `${path.join(harness.bunPrefix, "bin")}${path.delimiter}/tools`
        : "/tools",
    );
    for (const command of harness.commands.filter(
      ({ file }) => file !== "cargo",
    ))
      assert.equal(command.env.PATH, "/tools");
    assert.equal(harness.dependencies.environment.PATH, "/tools");
    assert.deepEqual(harness.writes, []);
  }
});

test("a failed Bun install stops before cargo and completion writes", async () => {
  const harness = testboxHarness();
  harness.outcomes.set(
    `npm install --global --prefix ${harness.bunPrefix} bun@1.8.2`,
    {
      exitCode: 3,
      stdout: "",
      stderr: "install failed",
    },
  );
  await assert.rejects(
    runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    { message: "Bun install failed" },
  );
  assert.deepEqual(
    harness.commands.map(({ file }) => file),
    ["git", "git", "npm"],
  );
  assert.deepEqual(harness.writes, []);
});

test("an invalid synced Bun pin stops before installation and cargo", async () => {
  const harness = testboxHarness();
  harness.files.set(
    path.join("/repo", ".bun-version"),
    Buffer.from("latest\n"),
  );
  await assert.rejects(
    runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    {
      message:
        "Bun pin is invalid: .bun-version must contain one exact Bun version.",
    },
  );
  assert.deepEqual(
    harness.commands.map(({ file }) => file),
    ["git", "git"],
  );
  assert.deepEqual(harness.writes, []);
});
