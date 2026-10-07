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

const commands: Array<{ suite: string; name: string; shard?: string }> = [
  { suite: "repository", name: "repository" },
  { suite: "package", name: "package" },
  ...["unit", "browser"].flatMap((suite) =>
    Array.from({ length: 4 }, (_, offset) => ({
      suite,
      name: `${suite}-${offset + 1}-of-4`,
      shard: `${offset + 1}/4`,
    })),
  ),
  { suite: "hydration", name: "hydration" },
];

test("the 11 commands derive exact cargo arguments, report names and streamed output", async () => {
  for (const { suite, name, shard } of commands) {
    const harness = testboxHarness();
    const args = [
      "--expect",
      TESTBOX_FINGERPRINT,
      "--suite",
      suite,
      ...(shard ? ["--shard", shard] : []),
    ];
    assert.equal(parseTestboxArguments(args).commandName, name);
    assert.equal(await runTestboxSuite(args, harness.dependencies), 0);
    assert.deepEqual(
      harness.commands.map(({ file, args, captureOutput }) => ({
        file,
        args,
        captureOutput,
      })),
      [
        {
          file: "git",
          args: ["rev-parse", "--is-shallow-repository"],
          captureOutput: true,
        },
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
    const cargo = harness.commands.at(-1)!;
    assert.equal(cargo.cwd, "/repo");
    assert.equal(
      cargo.env.MOKLY_VERIFICATION_REPORT,
      `.context/verification-reports/remote/${name}.json`,
    );
    assert.equal(cargo.env.PATH, "/tools");
    assert.deepEqual(harness.writes, []);
  }
});

const REPOSITORY = ["--expect", TESTBOX_FINGERPRINT, "--suite", "repository"];

test("the repository command forwards each dependency audit mode to cargo", async () => {
  for (const mode of ["baseline", "strict"]) {
    const harness = testboxHarness();
    const args = [...REPOSITORY, "--dependency-audit", mode];
    assert.equal(parseTestboxArguments(args).commandName, "repository");
    assert.equal(await runTestboxSuite(args, harness.dependencies), 0);
    assert.deepEqual(harness.commands.at(-1)?.args, [
      "xtask",
      "check",
      "--executor",
      "local",
      "--suite",
      "repository",
      "--dependency-audit",
      mode,
    ]);
  }
});

test("arguments fail before any read or subprocess", async () => {
  for (const args of [
    [],
    ["--expect", TESTBOX_FINGERPRINT],
    ["--suite", "unit"],
    ["--expect", "bad", "--suite", "unit"],
    ["--expect", `${TESTBOX_FINGERPRINT}\n`, "--suite", "unit"],
    [...TESTBOX_ARGUMENTS, "--unknown"],
    [...TESTBOX_ARGUMENTS, "--suite", "browser"],
    ["--expect", TESTBOX_FINGERPRINT, "--suite", "invalid"],
    ["--expect", TESTBOX_FINGERPRINT, "--suite", "unit", "--shard"],
    ["--expect", TESTBOX_FINGERPRINT, "--suite", "unit", "--shard", "0/4"],
    ["--expect", TESTBOX_FINGERPRINT, "--suite", "unit", "--shard", "5/4"],
    [
      "--expect",
      TESTBOX_FINGERPRINT,
      "--suite",
      "unit",
      "--shard",
      "1/9007199254740992",
    ],
    [
      "--expect",
      TESTBOX_FINGERPRINT,
      "--suite",
      "repository",
      "--shard",
      "1/4",
    ],
    ["--expect", TESTBOX_FINGERPRINT, "--suite", "package", "--shard", "1/4"],
    ["--expect", TESTBOX_FINGERPRINT, "--suite", "hydration", "--shard", "1/4"],
    [...REPOSITORY, "--dependency-audit"],
    [...REPOSITORY, "--dependency-audit", "lenient"],
    [
      ...REPOSITORY,
      "--dependency-audit",
      "strict",
      "--dependency-audit",
      "strict",
    ],
    [
      "--expect",
      TESTBOX_FINGERPRINT,
      "--suite",
      "unit",
      "--dependency-audit",
      "strict",
    ],
    [
      "--expect",
      TESTBOX_FINGERPRINT,
      "--suite",
      "package",
      "--dependency-audit",
      "baseline",
    ],
  ]) {
    const harness = testboxHarness();
    await assert.rejects(
      runTestboxSuite(args, harness.dependencies),
      /usage|fingerprint|suite|shard/u,
    );
    assert.deepEqual(harness.events, []);
  }
});

test("a fingerprint mismatch stops before history, installs and cargo", async () => {
  const harness = testboxHarness();
  harness.dependencies.readFingerprint = async () => `sha256:${"b".repeat(64)}`;
  await assert.rejects(
    runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    {
      message: `source-tree fingerprint does not match: expected ${TESTBOX_FINGERPRINT}; actual sha256:${"b".repeat(64)}`,
    },
  );
  assert.deepEqual(harness.commands, []);
  assert.deepEqual(harness.writes, []);
});

test("shallow history is restored before checking the lockfile or starting cargo", async () => {
  const harness = testboxHarness();
  harness.outcomes.set("git rev-parse --is-shallow-repository", {
    exitCode: 0,
    stdout: "true\n",
    stderr: "",
  });
  await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies);
  assert.deepEqual(harness.commands[1]?.args, [
    "fetch",
    "--unshallow",
    "--tags",
    "origin",
  ]);
  assert.equal(harness.commands[1]?.captureOutput, false);
  assert.deepEqual(harness.events.slice(0, 4), [
    "fingerprint",
    "git rev-parse --is-shallow-repository",
    "git fetch --unshallow --tags origin",
    "read:/repo/package-lock.json",
  ]);
});

for (const state of ["changed", "missing"]) {
  test(`a ${state} lockfile stamp triggers install, Chromium and a new stamp`, async () => {
    const harness = testboxHarness();
    if (state === "missing") harness.files.delete(harness.stamp);
    else harness.files.set(harness.stamp, Buffer.from("old-digest\n"));
    await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies);
    assert.deepEqual(
      harness.commands.slice(1, 3).map(({ file, args, captureOutput }) => ({
        file,
        args,
        captureOutput,
      })),
      [
        { file: "npm", args: ["ci"], captureOutput: false },
        {
          file: "npx",
          args: ["playwright", "install", "chromium"],
          captureOutput: false,
        },
      ],
    );
    assert.deepEqual(harness.writes, [
      { file: harness.stamp, contents: `${harness.digest}\n` },
    ]);
    const order = harness.events;
    assert.ok(
      order.indexOf("npx playwright install chromium") <
        order.indexOf(`write:${harness.stamp}`),
    );
    assert.ok(
      order.indexOf(`write:${harness.stamp}`) <
        order.indexOf(
          "cargo xtask check --executor local --suite unit --shard 1/4",
        ),
    );
  });
}

test("a lockfile content change triggers installation even with the old stamp", async () => {
  const harness = testboxHarness();
  harness.files.set(
    path.join("/repo", "package-lock.json"),
    Buffer.from("new lockfile"),
  );
  await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies);
  assert.ok(harness.commands.some(({ file }) => file === "npm"));
  assert.notEqual(harness.writes[0]?.contents, `${harness.digest}\n`);
});

test("secrets and GitHub identity variables do not enter child commands", async () => {
  const harness = testboxHarness();
  Object.assign(harness.dependencies.environment, {
    BLACKSMITH_ORG_TOKEN: "test-only-key",
    GITHUB_SHA: "workflow-commit",
    GITHUB_ACTIONS: "true",
    CI: "true",
    MOKLY_VERIFICATION_REPORT: "old.json",
  });
  await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies);
  for (const { env } of harness.commands) {
    for (const name of [
      "BLACKSMITH_ORG_TOKEN",
      "GITHUB_SHA",
      "GITHUB_ACTIONS",
      "CI",
    ])
      assert.equal(env[name], undefined, name);
  }
  assert.equal(harness.dependencies.environment.GITHUB_SHA, "workflow-commit");
});

test("the wrapper returns the exact cargo exit code", async () => {
  const harness = testboxHarness();
  harness.outcomes.set(
    "cargo xtask check --executor local --suite unit --shard 1/4",
    {
      exitCode: 7,
      stdout: "",
      stderr: "",
    },
  );
  assert.equal(
    await runTestboxSuite(TESTBOX_ARGUMENTS, harness.dependencies),
    7,
  );
});
