import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  collectWorkerReport,
  localWorkerLimit,
  primaryCheckError,
  workerFailure,
  verificationTasks,
} from "../scripts/verification/local-check.mjs";
import { validateLocalReports } from "../scripts/verification/local-evidence.mjs";
import { chooseBrowserPorts } from "../scripts/verification/local-ports.mjs";
import {
  captureSource,
  createSnapshot,
  removeSnapshot,
  verifySource,
} from "../scripts/verification/local-snapshot.mjs";
import { runLocalTasks } from "../scripts/verification/local-tasks.mjs";

import { browserTest, unitReport } from "./helpers/verification_evidence.js";

const execute = promisify(execFile);

test("local scheduling starts long independent shards before shorter ones", () => {
  const tasks = verificationTasks();
  assert.equal(tasks.length, 10);
  assert.deepEqual(
    tasks.slice(0, 5).map((task) => task.key),
    ["repository", "browser-2", "unit-4", "browser-3", "package"],
  );
  assert.deepEqual(
    tasks.slice(5).map((task) => task.key),
    ["browser-4", "browser-1", "unit-1", "unit-2", "unit-3"],
  );
  assert.equal(new Set(tasks.map((task) => task.key)).size, 10);
  assert.equal(localWorkerLimit(8), 4);
  assert.equal(localWorkerLimit(3), 3);
});

test("an interrupted check reports the signal, not a secondary worker failure", () => {
  const workerFailure = new Error("repository failed (SIGTERM)");
  const interrupted = new Error("Local verification interrupted by SIGTERM");
  assert.equal(primaryCheckError(workerFailure, interrupted), interrupted);
  assert.equal(primaryCheckError(workerFailure), workerFailure);
});

test("a failed shard retains its diagnostic report without counting as complete", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-failed-report-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source.json");
  const retained = path.join(root, "retained.json");
  const report = {
    failures: [
      {
        name: "tests/watch_resource_boundaries.test.ts",
        diagnostic: "test failed",
      },
    ],
  };
  await fs.writeFile(source, JSON.stringify(report));
  assert.deepEqual(await collectWorkerReport(source, retained, false), report);
  assert.deepEqual(JSON.parse(await fs.readFile(retained, "utf8")), report);
  assert.match(
    workerFailure("unit-4", { exitCode: 1, signal: null }, report).message,
    /unit-4.*watch_resource_boundaries\.test\.ts.*test failed/s,
  );
  assert.equal(
    await collectWorkerReport(path.join(root, "missing"), retained, false),
    undefined,
  );
  await assert.rejects(
    collectWorkerReport(path.join(root, "missing"), retained, true),
    /ENOENT/,
  );
});

test("a snapshot preserves HEAD, baseline, index, staged and unstaged bytes, untracked files and symlinks", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-snapshot-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await git(root, "init", "-q");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "config", "user.name", "Test");
  await fs.writeFile(
    path.join(root, ".gitignore"),
    "node_modules/\n.context/\n",
  );
  await fs.writeFile(path.join(root, "edited.txt"), "original");
  await fs.writeFile(path.join(root, "removed.txt"), "delete me");
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ workspaces: ["packages/viewer"] }),
  );
  await fs.mkdir(path.join(root, "packages/viewer"), { recursive: true });
  await fs.writeFile(
    path.join(root, "packages/viewer/package.json"),
    JSON.stringify({ name: "@mokly/viewer" }),
  );
  await git(root, "add", ".");
  await git(root, "commit", "-qm", "original");
  await git(root, "update-ref", "refs/remotes/origin/main", "HEAD");
  const baseline = (await git(root, "rev-parse", "origin/main")).trim();
  await fs.writeFile(path.join(root, "edited.txt"), "staged");
  await git(root, "add", "edited.txt");
  await fs.writeFile(path.join(root, "edited.txt"), "working");
  await fs.rm(path.join(root, "removed.txt"));
  await fs.writeFile(path.join(root, "new.txt"), "not staged");
  await fs.symlink("new.txt", path.join(root, "link.txt"));
  await fs.mkdir(path.join(root, "node_modules"));
  await fs.mkdir(path.join(root, "node_modules/@mokly"));
  await fs.symlink(
    "../../packages/viewer",
    path.join(root, "node_modules/@mokly/viewer"),
  );
  const context = path.join(root, ".context");
  await fs.mkdir(context);
  const captured = await captureSource(root);
  const owner = await fs.mkdtemp(path.join(context, "local-check-"));
  const snapshot = await createSnapshot(root, captured, owner, "worker");
  assert.equal((await git(snapshot, "rev-parse", "HEAD")).trim(), baseline);
  assert.equal(
    (await git(snapshot, "rev-parse", "origin/main")).trim(),
    baseline,
  );
  assert.equal((await git(snapshot, "show", ":edited.txt")).trim(), "staged");
  assert.equal(
    await fs.readFile(path.join(snapshot, "edited.txt"), "utf8"),
    "working",
  );
  await assert.rejects(fs.stat(path.join(snapshot, "removed.txt")), {
    code: "ENOENT",
  });
  assert.equal(
    await fs.readFile(path.join(snapshot, "new.txt"), "utf8"),
    "not staged",
  );
  assert.equal(await fs.readlink(path.join(snapshot, "link.txt")), "new.txt");
  assert.equal(
    await fs.realpath(path.join(snapshot, "node_modules/@mokly/viewer")),
    path.join(snapshot, "packages/viewer"),
  );
  const peer = await createSnapshot(root, captured, owner, "peer");
  await fs.mkdir(path.join(snapshot, ".context"));
  await fs.writeFile(path.join(snapshot, ".context/worker-output"), "private");
  await assert.rejects(fs.stat(path.join(peer, ".context/worker-output")), {
    code: "ENOENT",
  });
  assert.equal(
    await fs
      .readFile(path.join(snapshot, "node_modules/.ignored"), "utf8")
      .catch(() => ""),
    "",
  );
  await verifySource(root, captured);
  await fs.writeFile(path.join(root, "new.txt"), "changed");
  await assert.rejects(verifySource(root, captured), /drift|changed/i);
  await removeSnapshot(root, snapshot, owner);
  await assert.rejects(fs.stat(snapshot), { code: "ENOENT" });
  assert.equal(
    await fs.readFile(path.join(peer, "new.txt"), "utf8"),
    "not staged",
  );
  await assert.rejects(
    removeSnapshot(root, root, owner),
    /own|snapshot|outside/i,
  );
  assert.equal(
    await fs.readFile(path.join(root, "new.txt"), "utf8"),
    "changed",
  );
  await removeSnapshot(root, peer, owner);
});

test("browser port selection refuses a conflicting listener and never reuses sibling ports", async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await assert.rejects(
      chooseBrowserPorts(4, String(address.port)),
      /EADDRINUSE/,
    );
    const ports = await chooseBrowserPorts(4);
    assert.equal(new Set(ports).size, 4);
    assert.ok(ports.every((port) => port > 0));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("local evidence rejects missing, duplicate, stale and failed shards", () => {
  const files = [1, 2, 3, 4].map((n) => `tests/${n}.test.ts`);
  const browserFiles = [1, 2, 3, 4].map((n) => `tests/browser/${n}.spec.ts`);
  const browserTests = browserFiles.map((file, n) =>
    browserTest(String(n), file),
  );
  const unit = files.map((file, n) => unitReport(n + 1, [file], files));
  const browser = browserTests.map((item, n) => ({
    ...unitReport(n + 1, [item.file], browserFiles),
    suite: "browser",
    fullTests: browserTests,
    assignedTests: [item],
    observedTests: [{ ...item, durationMs: 1, status: "passed", errors: [] }],
  }));
  const options = {
    commit: "a".repeat(40),
    runtime: "node-24",
    unitFiles: files,
    browserTests,
  };
  validateLocalReports([...unit, ...browser], options);
  assert.throws(
    () => validateLocalReports([...unit.slice(1), ...browser], options),
    /missing/i,
  );
  assert.throws(
    () => validateLocalReports([...unit, unit[0], ...browser], options),
    /extra|duplicate/i,
  );
  assert.throws(
    () =>
      validateLocalReports(
        [{ ...unit[0], commit: "b".repeat(40) }, ...unit.slice(1), ...browser],
        options,
      ),
    /commit/i,
  );
  assert.throws(
    () =>
      validateLocalReports(
        [{ ...unit[0], observedFiles: [] }, ...unit.slice(1), ...browser],
        options,
      ),
    /observed/i,
  );
});

test("task fan-out stops dispatch on failure and drains existing workers", async () => {
  const started: string[] = [];
  const finished: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await assert.rejects(
    runLocalTasks(
      ["fail", "active", "not-started"],
      2,
      async (task) => {
        started.push(task);
        if (task === "fail") throw new Error("first failure");
        await held;
        finished.push(task);
      },
      async () => {
        release();
      },
    ),
    /first failure/,
  );
  assert.deepEqual(started, ["fail", "active"]);
  assert.deepEqual(finished, ["active"]);
});

async function git(root: string, ...args: string[]): Promise<string> {
  return (await execute("git", args, { cwd: root })).stdout;
}
