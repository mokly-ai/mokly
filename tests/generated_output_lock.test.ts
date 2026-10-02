import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  acquireOutputLock,
  assertOutputLockHeld,
  outputLockPath,
} from "../dist/build/output_lock.js";
import { loadConfig } from "../dist/config/load.js";
import { isCancellation } from "../dist/errors.js";
import { isPackageOwnedIgnoredWatchPath } from "../dist/server/watch_paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

async function repository(context: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-output-lock-"));
  context.after(() => fs.rm(root, { force: true, recursive: true }));
  return root;
}

async function writeLock(root: string, content: string): Promise<string> {
  const file = outputLockPath(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
  return file;
}

function holder(pid: number | undefined, token = randomUUID()): string {
  return JSON.stringify({ pid, token });
}

async function stoppedPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await once(child, "exit");
  assert.ok(child.pid);
  return child.pid;
}

test(
  "a second writer waits until the first holder releases",
  { timeout: 10_000 },
  async (context) => {
    const root = await repository(context);
    const first = await acquireOutputLock(root);
    let acquired = false;
    const second = acquireOutputLock(root, { pollMs: 10 }).then((lock) => {
      acquired = true;
      return lock;
    });
    await delay(150);
    assert.equal(acquired, false);
    await first.release();
    const lock = await second;
    assertOutputLockHeld(lock, root);
    await lock.release();
  },
);

test("release removes the lock and its empty directories once", async (context) => {
  const root = await repository(context);
  const lock = await acquireOutputLock(root);
  assert.equal(lock.path, outputLockPath(root));
  assert.equal(
    JSON.parse(await fs.readFile(lock.path, "utf8")).pid,
    process.pid,
  );
  await lock.release();
  await assert.rejects(fs.access(path.join(root, ".mokly-cache")), {
    code: "ENOENT",
  });
  assert.throws(() => assertOutputLockHeld(lock, root), /writer lock/u);
  await lock.release();
  const history = path.join(root, ".mokly-cache", "baselines");
  await fs.mkdir(history, { recursive: true });
  await (await acquireOutputLock(root)).release();
  await assert.rejects(fs.access(path.dirname(lock.path)), { code: "ENOENT" });
  await fs.access(history);
});

for (const [name, pid] of [
  ["a stopped process", stoppedPid],
  ["this process without holding it", async () => process.pid],
] as const)
  test(`a lock left by ${name} is reclaimed`, async (context) => {
    const root = await repository(context);
    await writeLock(root, holder(await pid()));
    const lock = await acquireOutputLock(root, { timeoutMs: 5_000 });
    assert.equal(
      JSON.parse(await fs.readFile(lock.path, "utf8")).pid,
      process.pid,
    );
    await lock.release();
    await assert.rejects(fs.access(path.dirname(lock.path)), {
      code: "ENOENT",
    });
  });

test(
  "a running holder keeps its lock until it stops",
  { timeout: 10_000 },
  async (context) => {
    const root = await repository(context);
    const running = spawn(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      {
        stdio: "ignore",
      },
    );
    context.after(() => {
      running.kill();
    });
    assert.ok(running.pid);
    const record = holder(running.pid);
    const file = await writeLock(root, record);
    await assert.rejects(
      acquireOutputLock(root, { pollMs: 20, timeoutMs: 200 }),
      (error: Error) =>
        error.message.includes(
          `Another Mokly process (pid ${running.pid}) is still writing generated output after 0.2 s. If no Mokly command is running, delete ${file} and retry.`,
        ),
    );
    assert.equal(await fs.readFile(file, "utf8"), record);
    running.kill();
    await once(running, "exit");
    const lock = await acquireOutputLock(root, { timeoutMs: 5_000 });
    await lock.release();
  },
);

for (const content of ["not json", holder(undefined), '{"pid":1}'])
  test(`an unproven holder record is never reclaimed: ${content}`, async (context) => {
    const root = await repository(context);
    const file = await writeLock(root, content);
    await assert.rejects(
      acquireOutputLock(root, { pollMs: 20, timeoutMs: 100 }),
      /\[mokly\/build-invalid\] Another (?:Mokly )?process (?:\(pid 1\) )?is still writing generated output after 0\.1 s/u,
    );
    assert.equal(await fs.readFile(file, "utf8"), content);
  });

test(
  "cancellation stops the wait without touching the holder's lock",
  { timeout: 10_000 },
  async (context) => {
    const root = await repository(context);
    const first = await acquireOutputLock(root);
    const controller = new AbortController();
    const waiting = acquireOutputLock(root, {
      pollMs: 60_000,
      signal: controller.signal,
    });
    await delay(50);
    controller.abort();
    await assert.rejects(
      waiting,
      (error: Error) =>
        isCancellation(error) &&
        /Cancelled while waiting for another Mokly command to finish writing generated output\./u.test(
          error.message,
        ),
    );
    await assert.rejects(
      acquireOutputLock(root, { signal: AbortSignal.abort() }),
      (error: Error) => isCancellation(error),
    );
    assertOutputLockHeld(first, root);
    await first.release();
  },
);

test("every spelling of a repository shares one lock", async (context) => {
  const root = await repository(context);
  const alias = `${root}-alias`;
  await fs.symlink(root, alias, "junction");
  context.after(() => fs.rm(alias, { force: true }));
  assert.equal(outputLockPath(alias), outputLockPath(root));
});

test("watches never observe the lock", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const file = outputLockPath(config.repoRoot);
  assert.equal(isPackageOwnedIgnoredWatchPath(file, config), true);
  assert.equal(
    isPackageOwnedIgnoredWatchPath(path.dirname(file), config),
    true,
  );
});

test("a lock directory that a concurrent release removes is recreated", async (context) => {
  const root = await repository(context);
  const locks = path.dirname(outputLockPath(root));
  const lstat = fs.lstat.bind(fs);
  let removed = 0;
  context.mock.method(fs, "lstat", async (candidate: string) => {
    if (candidate === locks && removed === 0) {
      removed += 1;
      await fs.rm(path.dirname(locks), { force: true, recursive: true });
    }
    return lstat(candidate);
  });
  const lock = await acquireOutputLock(root, { timeoutMs: 5_000 });
  assert.equal(removed, 1);
  assertOutputLockHeld(lock, root);
  await lock.release();
});

test("a lock directory replaced by a regular file fails at once", async (context) => {
  const root = await repository(context);
  const locks = path.dirname(outputLockPath(root));
  await fs.mkdir(path.dirname(locks), { recursive: true });
  await fs.writeFile(locks, "not a directory");
  await assert.rejects(
    acquireOutputLock(root, { pollMs: 20, timeoutMs: 5_000 }),
    /generated-output lock directory must be a real directory/u,
  );
  assert.equal(await fs.readFile(locks, "utf8"), "not a directory");
});
