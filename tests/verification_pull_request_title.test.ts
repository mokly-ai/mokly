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

test("accepted types cover AGENTS examples and origin main history", async () => {
  const [agents, history] = await Promise.all([
    fs.readFile(path.join(repositoryRoot, "AGENTS.md"), "utf8"),
    execute("git", ["log", "--format=%s", "origin/main"], {
      cwd: repositoryRoot,
    }).then(({ stdout }) => stdout),
  ]);
  const observed = new Set(
    [
      ...`${agents}\n${history}`.matchAll(
        /^([a-z][a-z0-9-]*)(?:\([^)]*\))?!?: /gmu,
      ),
    ].map(([, type]) => type!),
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

test("pull request title length is bounded at 50 Unicode code points", () => {
  const fiftyAscii = `feat: ${"a".repeat(44)}`;
  const fiftyUnicode = `feat: ${"🙂".repeat(44)}`;
  assert.equal([...fiftyAscii].length, 50);
  assert.equal([...fiftyUnicode].length, 50);
  assert.equal(isValidPullRequestTitle(fiftyAscii), true);
  assert.equal(isValidPullRequestTitle(fiftyUnicode), true);
  assert.equal(isValidPullRequestTitle(`${fiftyAscii}a`), false);
  assert.equal(isValidPullRequestTitle(`${fiftyUnicode}🙂`), false);
});

test("pull request title CLI reads only the environment and has fixed failure copy", async () => {
  await assert.doesNotReject(
    execute(process.execPath, [script], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PULL_REQUEST_TITLE: "feat(publish)!: upload catalogue content deltas",
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

test("CI and release contracts document the enforced title boundary", async () => {
  const [ci, release] = await Promise.all([
    fs.readFile(
      path.join(repositoryRoot, "docs/protocol/ci-verification.md"),
      "utf8",
    ),
    fs.readFile(
      path.join(repositoryRoot, "docs/protocol/npm-release.md"),
      "utf8",
    ),
  ]);
  assert.ok(ci.includes("scripts/verification/pull-request-title.mjs"));
  assert.ok(ci.includes(PULL_REQUEST_TITLE_ERROR));
  for (const type of PULL_REQUEST_TITLE_TYPES)
    assert.ok(ci.includes(`\`${type}\``), type);
  assert.match(ci, /\[a-z0-9\._\/-\]\+/u);
  assert.match(release, /Pull Request Title Contract/u);
  assert.match(release, /chore\(main\): release 0\.13\.0/u);
  assert.match(release, /BREAKING CHANGE:/u);
});
