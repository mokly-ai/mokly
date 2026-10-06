import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  parseSourceTreeArguments,
  readSourceTree,
} from "../scripts/verification/source-tree.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const script = path.join(
  repositoryRoot,
  "scripts/verification/source-tree.mjs",
);

test("source-tree arguments accept an exact fingerprint and optional HEAD output", () => {
  const expected = `sha256:${"a".repeat(64)}`;
  assert.deepEqual(parseSourceTreeArguments([]), { printHead: false });
  assert.deepEqual(
    parseSourceTreeArguments(["--expect", expected, "--print-head"]),
    {
      expected,
      printHead: true,
    },
  );
  for (const args of [
    ["--expect"],
    ["--expect", "invalid"],
    ["--expect", `${expected}\n`],
    ["--unknown"],
    ["--print-head", "--print-head"],
    ["--print-head", "true"],
    ["--expect", expected, "--expect", expected],
  ])
    assert.throws(() => parseSourceTreeArguments(args), /usage|fingerprint/u);
});

test("source-tree CLI prints only the fingerprint and requested repository HEAD", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-source-cli-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await execute("git", ["init", "--initial-branch=main"], { cwd: root });
  await fs.writeFile(path.join(root, "file.txt"), "CLI source");
  await execute("git", ["add", "file.txt"], { cwd: root });
  await execute(
    "git",
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--message",
      "test: CLI baseline",
    ],
    { cwd: root },
  );
  const fingerprint = await readSourceTree(root);
  const head = (
    await execute("git", ["rev-parse", "HEAD"], { cwd: root })
  ).stdout.trim();
  const normal = await execute(process.execPath, [script], { cwd: root });
  assert.equal(normal.stdout, `${fingerprint}\n`);
  assert.equal(normal.stderr, "");
  const probe = await execute(
    process.execPath,
    [script, "--expect", fingerprint, "--print-head"],
    { cwd: root },
  );
  assert.equal(probe.stdout, `${fingerprint}\n${head}\n`);
  assert.equal(probe.stderr, "");
  await assert.rejects(
    execute(
      process.execPath,
      [script, "--expect", `sha256:${"0".repeat(64)}`],
      { cwd: root },
    ),
    (error: unknown) => {
      assert.equal((error as { code: number }).code, 1);
      assert.match((error as { stderr: string }).stderr, /fingerprint/u);
      return true;
    },
  );
});

test("source-tree CLI rejects arguments before invoking Git", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-source-invalid-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(
    execute(process.execPath, [script, "--unknown"], { cwd: root }),
    (error: unknown) => {
      const result = error as { code: number; stderr: string; stdout: string };
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /usage/u);
      assert.doesNotMatch(result.stderr, /not a git repository/u);
      return true;
    },
  );
});
