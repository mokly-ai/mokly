import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const script = path.join(
  repositoryRoot,
  "scripts/verification/remove-remote-state.mjs",
);
const failureMessage =
  "Could not prepare this checkout for remote-free verification. Run this command in a writable Git repository and try again.\n";

test("remote-free verification removes configured and leftover remote state", async (context) => {
  const fixture = await remoteStateFixture(context);
  const before = await checkoutSnapshot(fixture.clone);
  const symbolic = await git(fixture.clone, [
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
  ]);
  assert.equal(symbolic.stdout.trim(), "refs/remotes/origin/main");
  assert.deepEqual(
    (await git(fixture.clone, ["remote"])).stdout.trim().split("\n"),
    ["backup", "origin"],
  );
  assert.equal(
    (await git(fixture.clone, ["config", "branch.main.remote"])).stdout.trim(),
    "backup",
  );
  assert.equal(
    (await git(fixture.clone, ["config", "branch.main.merge"])).stdout.trim(),
    "refs/heads/main",
  );
  const packed = await fs.readFile(
    path.join(fixture.clone, ".git/packed-refs"),
    "utf8",
  );
  for (const ref of [
    "refs/remotes/backup/main",
    "refs/remotes/origin/main",
    "refs/remotes/pull/1/merge",
  ])
    assert.ok(packed.includes(ref), ref);

  const result = await execute(process.execPath, [script], {
    cwd: fixture.clone,
    encoding: "utf8",
  });
  assert.deepEqual(result, { stderr: "", stdout: "" });

  assert.equal((await git(fixture.clone, ["remote"])).stdout, "");
  assert.equal(
    (
      await git(fixture.clone, [
        "for-each-ref",
        "--format=%(refname)",
        "refs/remotes/",
      ])
    ).stdout,
    "",
  );
  const config = (await git(fixture.clone, ["config", "--local", "--list"]))
    .stdout;
  assert.doesNotMatch(config, /^branch\..+\.(?:remote|merge)=/mu);
  const fetchHead = await fetchHeadPath(fixture.clone);
  await assert.rejects(fs.lstat(fetchHead), { code: "ENOENT" });
  await assert.rejects(git(fixture.clone, ["fetch", "origin"]));
  assert.doesNotMatch(
    await fs.readFile(path.join(fixture.clone, ".git/packed-refs"), "utf8"),
    /refs\/remotes\//u,
  );
  assert.deepEqual(await checkoutSnapshot(fixture.clone), before);
});

test("remote-free verification has fixed guidance outside a Git repository", async (context) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-remote-state-error-"),
  );
  context.after(() => fs.rm(directory, { force: true, recursive: true }));

  await assert.rejects(
    execute(process.execPath, [script], { cwd: directory, encoding: "utf8" }),
    (error: unknown) => {
      const result = error as {
        code: number;
        stderr: string;
        stdout: string;
      };
      assert.equal(result.code, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, failureMessage);
      return true;
    },
  );
});

async function remoteStateFixture(
  context: TestContext,
): Promise<{ clone: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-remote-state-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  const source = path.join(root, "source");
  const clone = path.join(root, "clone");
  await fs.mkdir(source);
  await git(source, ["init", "-q", "-b", "main"]);
  await git(source, ["config", "user.email", "test@example.invalid"]);
  await git(source, ["config", "user.name", "Test"]);
  await Promise.all([
    fs.writeFile(path.join(source, "staged.txt"), "committed staged\n"),
    fs.writeFile(path.join(source, "working.txt"), "committed working\n"),
  ]);
  await git(source, ["add", "."]);
  await git(source, ["commit", "-qm", "test: remote state fixture"]);
  await execute("git", ["clone", "-q", source, clone]);
  await git(clone, ["config", "user.email", "test@example.invalid"]);
  await git(clone, ["config", "user.name", "Test"]);
  await git(clone, ["remote", "add", "backup", source]);
  await git(clone, ["fetch", "-q", "backup"]);
  await git(clone, [
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
    "refs/remotes/origin/main",
  ]);
  await git(clone, ["update-ref", "refs/remotes/pull/1/merge", "HEAD"]);
  await git(clone, ["branch", "--set-upstream-to=backup/main", "main"]);
  await git(clone, ["pack-refs", "--all"]);
  assert.equal(await exists(await fetchHeadPath(clone)), true);
  await fs.writeFile(path.join(clone, "staged.txt"), "staged change\n");
  await git(clone, ["add", "staged.txt"]);
  await fs.writeFile(path.join(clone, "working.txt"), "working change\n");
  await fs.writeFile(path.join(clone, "untracked.txt"), "untracked\n");
  return { clone };
}

async function checkoutSnapshot(directory: string) {
  const [head, index, status, staged, working, untracked] = await Promise.all([
    git(directory, ["rev-parse", "HEAD"]),
    git(directory, ["ls-files", "--stage", "-z"]),
    git(directory, ["status", "--porcelain=v2", "-z", "--untracked-files=all"]),
    fs.readFile(path.join(directory, "staged.txt")),
    fs.readFile(path.join(directory, "working.txt")),
    fs.readFile(path.join(directory, "untracked.txt")),
  ]);
  return {
    head: head.stdout,
    index: index.stdout,
    staged,
    status: status.stdout,
    untracked,
    working,
  };
}

async function fetchHeadPath(directory: string): Promise<string> {
  const result = await git(directory, [
    "rev-parse",
    "--git-path",
    "FETCH_HEAD",
  ]);
  const candidate = result.stdout.trim();
  return path.isAbsolute(candidate)
    ? candidate
    : path.resolve(directory, candidate);
}

async function git(directory: string, arguments_: readonly string[]) {
  return execute("git", [...arguments_], { cwd: directory, encoding: "utf8" });
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await fs.lstat(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
