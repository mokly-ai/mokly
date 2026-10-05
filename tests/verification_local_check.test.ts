import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { chooseBrowserPorts } from "../scripts/verification/local-ports.mjs";
import {
  captureSource,
  createSnapshot,
  createSnapshotDirectory,
  removeSnapshot,
  verifySource,
} from "../scripts/verification/local-snapshot.mjs";
import {
  collectWorkerReport,
  primaryCheckError,
  workerFailure,
} from "../scripts/verification/local-workers.mjs";

const execute = promisify(execFile);

test("snapshot owners resolve a system-temp alias before Git sees their path", async (t) => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-temp-alias-"),
  );
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const physical = path.join(temporary, "physical");
  const alias = path.join(temporary, "alias");
  await fs.mkdir(physical);
  await fs.symlink(
    physical,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  t.mock.method(os, "tmpdir", () => alias);
  const owner = await createSnapshotDirectory();
  assert.equal(path.dirname(owner), await fs.realpath(physical));
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
  await fs.mkdir(path.join(root, "node_modules/theme"));
  await fs.writeFile(
    path.join(root, "node_modules/theme/style.css"),
    "body {}",
  );
  await fs.mkdir(path.join(root, "node_modules/.bin"));
  await fs.symlink(
    "../theme/style.css",
    path.join(root, "node_modules/.bin/theme"),
  );
  const mergePath = path.join(root, ".git/MERGE_HEAD");
  await fs.writeFile(mergePath, `${baseline}\n`);
  const context = path.join(root, ".context");
  await fs.mkdir(context);
  const captured = await captureSource(root);
  const owner = await createSnapshotDirectory();
  t.after(() => fs.rm(owner, { recursive: true, force: true }));
  assert.equal(path.dirname(owner), await fs.realpath(os.tmpdir()));
  const snapshot = await createSnapshot(root, captured, owner, "worker");
  assert.equal((await git(snapshot, "rev-parse", "HEAD")).trim(), baseline);
  assert.equal(
    (await git(snapshot, "rev-parse", "origin/main")).trim(),
    baseline,
  );
  assert.equal(
    (await git(snapshot, "rev-parse", "MERGE_HEAD")).trim(),
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
  const dependency = path.join(snapshot, "node_modules/theme/style.css");
  assert.equal(await fs.realpath(dependency), dependency);
  assert.equal(
    await fs.realpath(path.join(snapshot, "node_modules/.bin/theme")),
    dependency,
  );
  const peer = await createSnapshot(root, captured, owner, "peer");
  await fs.writeFile(dependency, "body { color: red; }");
  for (const repository of [root, peer])
    assert.equal(
      await fs.readFile(
        path.join(repository, "node_modules/theme/style.css"),
        "utf8",
      ),
      "body {}",
    );
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
  await fs.rm(mergePath);
  await assert.rejects(verifySource(root, captured), /drift|changed/i);
  await fs.writeFile(mergePath, `${baseline}\n`);
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

async function git(root: string, ...args: string[]): Promise<string> {
  return (await execute("git", args, { cwd: root })).stdout;
}
