import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  PULL_REQUEST_TITLE_ERROR,
  PULL_REQUEST_TITLE_TYPES,
  isValidPullRequestTitle,
} from "../scripts/verification/pull-request-title.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const script = path.join(
  repositoryRoot,
  "scripts/verification/pull-request-title.mjs",
);

test("pull request titles accept repository Conventional Commit forms", () => {
  assert.deepEqual(PULL_REQUEST_TITLE_TYPES, [
    "build",
    "chore",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "revert",
    "style",
    "test",
  ]);
  for (const type of PULL_REQUEST_TITLE_TYPES)
    assert.equal(isValidPullRequestTitle(`${type}: valid title`), true, type);
  for (const title of [
    "chore(main): release 0.13.0",
    "feat(publish)!: upload catalogue content deltas",
    "fix!: retain the first publication",
    "ci(workflows/pr_title-v2): validate title safely",
    "docs: x",
  ])
    assert.equal(isValidPullRequestTitle(title), true, title);
});

test("accepted types cover the AGENTS examples", async () => {
  const agents = await fs.readFile(
    path.join(repositoryRoot, "AGENTS.md"),
    "utf8",
  );
  const observed = new Set(
    [...agents.matchAll(/^([a-z][a-z0-9-]*)(?:\([^)]*\))?!?: /gmu)].map(
      ([, type]) => type!,
    ),
  );
  assert.ok(observed.size > 0);
  for (const type of observed)
    assert.ok(PULL_REQUEST_TITLE_TYPES.includes(type), type);
  assert.ok(PULL_REQUEST_TITLE_TYPES.includes("revert"));
});

test("pull request titles reject malformed forms", () => {
  for (const title of [
    "",
    "feature: unsupported type",
    "Feat: uppercase type",
    "feat(): empty scope",
    "feat(UPPER): uppercase scope",
    "feat(scope space): invalid scope",
    "feat(scope@name): invalid scope",
    "feat!(scope): misplaced breaking marker",
    "feat: ",
    "feat:  leading description space",
    "feat:no separator space",
    " feat: leading title space",
    "feat: trailing title space ",
    "feat: title\nbody",
  ])
    assert.equal(isValidPullRequestTitle(title), false, JSON.stringify(title));
});

test("pull request title length is bounded at 72 Unicode code points", () => {
  for (const character of ["a", "🙂"])
    for (const length of [50, 51, 60, 71, 72, 73]) {
      const title = `feat: ${character.repeat(length - 6)}`;
      assert.equal([...title].length, length);
      assert.equal(isValidPullRequestTitle(title), length <= 72, title);
    }
});

test("the descriptive MockLink title fits the pull request limit", () => {
  const title = "feat: tier MockLink asChild placement and add build warnings";
  assert.equal([...title].length, 60);
  assert.equal(isValidPullRequestTitle(title), true);
});

test("pull request title CLI reads only the environment and has fixed failure copy", async () => {
  await assert.doesNotReject(
    execute(process.execPath, [script], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PULL_REQUEST_TITLE: `feat: ${"🙂".repeat(66)}`,
      },
    }),
  );
  await assert.rejects(
    execute(process.execPath, [script, "fix: ignored argument"], {
      cwd: repositoryRoot,
      env: { ...process.env, PULL_REQUEST_TITLE: "not a valid title" },
    }),
    (error: unknown) => {
      const output = error as { stderr: string; stdout: string };
      assert.equal(output.stdout, "");
      assert.equal(output.stderr, `${PULL_REQUEST_TITLE_ERROR}\n`);
      return true;
    },
  );
});

test("the title CLI rejects 73 code points and names the 72-character limit", async () => {
  assert.match(
    PULL_REQUEST_TITLE_ERROR,
    /whole title to 72 characters or fewer\.$/u,
  );
  await assert.rejects(
    execute(process.execPath, [script], {
      cwd: repositoryRoot,
      env: { ...process.env, PULL_REQUEST_TITLE: `feat: ${"🙂".repeat(67)}` },
    }),
    (error: unknown) => {
      const output = error as { code: number; stderr: string; stdout: string };
      assert.equal(output.code, 1);
      assert.equal(output.stdout, "");
      assert.equal(output.stderr, `${PULL_REQUEST_TITLE_ERROR}\n`);
      return true;
    },
  );
});

test("CI and release contracts document the enforced title boundary", async () => {
  const ci = await fs.readFile(
    path.join(repositoryRoot, "docs/protocol/ci-verification.md"),
    "utf8",
  );
  assert.ok(ci.includes("scripts/verification/pull-request-title.mjs"));
  assert.ok(ci.includes(PULL_REQUEST_TITLE_ERROR));
  for (const type of PULL_REQUEST_TITLE_TYPES)
    assert.ok(ci.includes(`\`${type}\``), type);
});
