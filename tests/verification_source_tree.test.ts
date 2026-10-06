import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import {
  fingerprintRecords,
  readSourceTree,
  sourcePaths,
} from "../scripts/verification/source-tree.mjs";

const execute = promisify(execFile);

async function repository(context: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-source-tree-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = async (...args: string[]) =>
    (await execute("git", args, { cwd: root })).stdout.trim();
  await git("init", "--initial-branch=main");
  await git("config", "user.name", "Verification Fixture");
  await git("config", "user.email", "verification@example.invalid");
  await git("config", "commit.gpgsign", "false");
  await fs.writeFile(path.join(root, "file.txt"), "hello\n");
  await fs.chmod(path.join(root, "file.txt"), 0o644);
  await git("add", "file.txt");
  await git("commit", "--message", "test: source baseline");
  return { root, git, file: path.join(root, "file.txt") };
}

test("fingerprint records have the specified NUL framing and SHA-256 digests", () => {
  const digest = createHash("sha256").update("hello\n").digest("hex");
  assert.equal(
    fingerprintRecords([
      { mode: "100644", path: Buffer.from("file.txt"), digest },
    ]),
    "sha256:e26c5151471b79c7bcbe0c02e035ce212514fd62e45b05a8a56c32e3f20fd432",
  );
  assert.equal(
    fingerprintRecords([]),
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("path listing removes duplicates and sorts raw bytes without decoding", () => {
  assert.deepEqual(
    sourcePaths(Buffer.from([0xff, 0, 0x61, 0, 0xc3, 0xa9, 0, 0x61, 0])),
    [Buffer.from("a"), Buffer.from("é"), Buffer.from([0xff])],
  );
  assert.deepEqual(sourcePaths(Buffer.alloc(0)), []);
});

test("record ordering uses unsigned path bytes", () => {
  const records = [
    { mode: "120000" as const, path: Buffer.from([0xff]), content: "target" },
    { mode: "100755" as const, path: Buffer.from("é"), content: "two" },
    { mode: "100644" as const, path: Buffer.from("a"), content: "one" },
  ].map(({ content, ...record }) => ({
    ...record,
    digest: createHash("sha256").update(content).digest("hex"),
  }));
  assert.equal(
    fingerprintRecords(records),
    "sha256:e48f5d627a219b39e7532c68cee17c1744fe04dbd8f1c04e5ff6c467344d8756",
  );
});

test("working-tree bytes, executable mode, path and deletion each change the digest", async (context) => {
  const { root, git, file } = await repository(context);
  const baseline = await readSourceTree(root);
  await fs.writeFile(file, "changed\n");
  assert.notEqual(await readSourceTree(root), baseline);
  await fs.writeFile(file, "hello\n");
  assert.equal(await readSourceTree(root), baseline);
  await fs.chmod(file, 0o755);
  assert.notEqual(await readSourceTree(root), baseline);
  await fs.chmod(file, 0o644);
  await fs.rename(file, path.join(root, "renamed.txt"));
  assert.notEqual(await readSourceTree(root), baseline);
  await fs.rename(path.join(root, "renamed.txt"), file);
  await fs.rm(file);
  const deleted = await readSourceTree(root);
  assert.notEqual(deleted, baseline);
  await git("add", "--update");
  assert.equal(await readSourceTree(root), deleted);
});

test("non-ignored untracked files participate while ignored files and Git metadata do not", async (context) => {
  const { root, git } = await repository(context);
  await fs.writeFile(path.join(root, ".gitignore"), "ignored/\n");
  await git("add", ".gitignore");
  const baseline = await readSourceTree(root);
  await fs.mkdir(path.join(root, "ignored"));
  await fs.writeFile(path.join(root, "ignored", "output"), "ignored");
  await fs.writeFile(path.join(root, ".git", "extra-metadata"), "metadata");
  assert.equal(await readSourceTree(root), baseline);
  await fs.writeFile(path.join(root, "untracked.txt"), "included");
  assert.notEqual(await readSourceTree(root), baseline);
  await fs.rm(path.join(root, "untracked.txt"));
  await fs.writeFile(path.join(root, ".gitignore"), "ignored/\nfile.txt\n");
  const ignoredTracked = await readSourceTree(root);
  await fs.writeFile(path.join(root, "file.txt"), "still tracked");
  assert.notEqual(await readSourceTree(root), ignoredTracked);
});

test("symbolic links hash their target bytes and retain broken links", async (context) => {
  const { root, file } = await repository(context);
  const ignored = path.join(root, "ignored");
  await fs.writeFile(path.join(root, ".gitignore"), "ignored\n");
  await fs.writeFile(ignored, "target content");
  await fs.rm(file);
  await fs.symlink("ignored", file);
  const first = await readSourceTree(root);
  await fs.writeFile(ignored, "different target content");
  assert.equal(await readSourceTree(root), first);
  await fs.rm(ignored);
  assert.equal(await readSourceTree(root), first);
  await fs.rm(file);
  await fs.symlink("another-target", file);
  assert.notEqual(await readSourceTree(root), first);
});

test("submodule index entries fail even when their working-tree path is absent", async (context) => {
  const { root, git } = await repository(context);
  const head = await git("rev-parse", "HEAD");
  await git("update-index", "--add", "--cacheinfo", `160000,${head},module`);
  await assert.rejects(readSourceTree(root), /submodule/u);
});

test("a directory in place of a tracked file fails rather than disappearing", async (context) => {
  const { root, file } = await repository(context);
  await fs.rm(file);
  await fs.mkdir(file);
  await assert.rejects(readSourceTree(root), /file type/u);
});

test("paths with whitespace and invalid UTF-8 retain their original bytes", async (context) => {
  const { root } = await repository(context);
  const name = Buffer.concat([
    Buffer.from(`${root}${path.sep}`),
    Buffer.from([0xff]),
  ]);
  await fs.writeFile(name, "one");
  await fs.writeFile(path.join(root, "space and\nnewline.txt"), "two");
  const first = await readSourceTree(root);
  await fs.writeFile(name, "changed");
  assert.notEqual(await readSourceTree(root), first);
});

test("an unpushed commit and the same uncommitted change have the same fingerprint", async (context) => {
  const { root, git, file } = await repository(context);
  const sibling = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-source-peer-"),
  );
  context.after(() => fs.rm(sibling, { recursive: true, force: true }));
  const origin = path.join(sibling, "origin.git");
  const peer = path.join(sibling, "peer");
  await execute("git", ["init", "--bare", "--initial-branch=main", origin]);
  await git("remote", "add", "origin", origin);
  await git("push", "--set-upstream", "origin", "main");
  await execute("git", ["clone", origin, peer]);
  await fs.writeFile(file, "same change\n");
  await fs.writeFile(path.join(peer, "file.txt"), "same change\n");
  const uncommitted = await readSourceTree(peer);
  await git("add", "file.txt");
  await git("commit", "--message", "test: unpushed change");
  assert.equal(
    await git(
      "for-each-ref",
      "--contains",
      "HEAD",
      "--format=%(refname)",
      "refs/remotes/origin/",
    ),
    "",
  );
  assert.notEqual(
    await git("rev-parse", "HEAD"),
    await git("rev-parse", "origin/main"),
  );
  assert.equal(await readSourceTree(root), uncommitted);
});
