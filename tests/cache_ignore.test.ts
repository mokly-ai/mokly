import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

import { acquireOutputLock } from "../dist/build/output_lock.js";
import { prepareCacheDirectory } from "../dist/config/cache_ignore.js";

import { CACHE_IGNORE_TEXT } from "./helpers/cache_ignore.js";

const run = promisify(execFile);

async function directory(context: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-cache-ignore-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  return root;
}

async function git(root: string, ...args: string[]): Promise<string> {
  return (await run("git", args, { cwd: root })).stdout;
}

test("Git never shows or adds the cache, even with a lock left behind", async (context) => {
  const root = await directory(context);
  await git(root, "init", "--quiet");
  const lock = await acquireOutputLock(root);
  try {
    assert.equal(
      await fs.readFile(path.join(root, ".mokly-cache", ".gitignore"), "utf8"),
      CACHE_IGNORE_TEXT,
    );
    assert.equal(await git(root, "status", "--porcelain", "-uall"), "");
    await git(root, "add", "--all");
    assert.equal(await git(root, "diff", "--cached", "--name-only"), "");
  } finally {
    await lock.release();
  }
});

test("the writer lock keeps an ignore file that already exists", async (context) => {
  const root = await directory(context);
  const file = path.join(root, ".mokly-cache", ".gitignore");
  await fs.mkdir(path.dirname(file));
  await fs.writeFile(file, "locks/\n");
  const lock = await acquireOutputLock(root);
  await lock.release();
  assert.equal(await fs.readFile(file, "utf8"), "locks/\n");
});

test("concurrent writers publish one complete ignore file and no temporary file", async (context) => {
  const cache = path.join(await directory(context), ".mokly-cache");
  await Promise.all(
    Array.from({ length: 16 }, () => prepareCacheDirectory(cache)),
  );
  assert.deepEqual(await fs.readdir(cache), [".gitignore"]);
  assert.equal(
    await fs.readFile(path.join(cache, ".gitignore"), "utf8"),
    CACHE_IGNORE_TEXT,
  );
});

test("a linked cache gets no ignore file, because Git does not read it", async (context) => {
  const root = await directory(context);
  const target = await directory(context);
  await fs.symlink(target, path.join(root, ".mokly-cache"), "junction");
  const lock = await acquireOutputLock(root);
  await lock.release();
  assert.deepEqual(await fs.readdir(target), ["locks"]);
});
