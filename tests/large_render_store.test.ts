import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import type { ChildProcessByStdio } from "node:child_process";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { TestContext } from "node:test";
import timers from "node:timers/promises";

import type { Running } from "../scripts/large/process.js";
import { resetRenderStore } from "../scripts/large/render_store.js";
import { prepareWarmSeed } from "../scripts/large/render_store_seed.js";
import type { TimingRecord } from "../scripts/large/timings.js";

test("each cold reset removes renders and preserves the other cache kinds", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-large-cold-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const namespace = path.join(root, "cache namespace é");
  const retained = [
    ["sources", "source bytes\n"],
    ["dependencies", "dependency bytes\n"],
    ["bundles", "bundle bytes\n"],
  ] as const;
  for (const [kind, bytes] of retained) {
    await fs.mkdir(path.join(namespace, kind), { recursive: true });
    await fs.writeFile(path.join(namespace, kind, "marker"), bytes);
  }
  const marker = path.join(namespace, "renders/marker");
  for (const bytes of ["old render bytes\n", "new cold render bytes\n"]) {
    await fs.mkdir(path.dirname(marker), { recursive: true });
    await fs.writeFile(marker, bytes);
    await resetRenderStore(namespace);
    await assert.rejects(fs.readFile(marker), { code: "ENOENT" });
    for (const [kind, expected] of retained)
      assert.equal(
        await fs.readFile(path.join(namespace, kind, "marker"), "utf8"),
        expected,
      );
  }
});

function seedRun(timings: TimingRecord[]): Running {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdio: ChildProcessByStdio<null, PassThrough, PassThrough>["stdio"] = [
    null,
    stdout,
    stderr,
    undefined,
    undefined,
  ];
  return {
    child: Object.assign(new ChildProcess(), {
      stdin: null,
      stdout,
      stderr,
      stdio,
    }),
    done: new Promise<void>(() => {}),
    kill: () => {},
    output: () => "",
    finishMemory: async () => {
      throw new Error("Warm preparation must not restart measured sampling");
    },
    timings,
  };
}

function seedEvent(
  stage: string,
  fields: Record<string, unknown>,
): TimingRecord {
  return {
    receivedMs: 0,
    event: {
      schemaVersion: 1,
      role: "core",
      pid: 20,
      session: "seed",
      stage,
      ...fields,
    },
  };
}

function writerState(sequence: number, queued: number, active: number) {
  return seedEvent("render.store", {
    event: "state",
    sequence,
    queued,
    active,
    hits: 0,
    misses: 3,
    faults: 0,
    writes: queued || active ? 0 : 3,
    bytes: queued || active ? 0 : 123,
    drops: 0,
  });
}

function seedPolling(t: TestContext) {
  let release = () => {};
  t.mock.method(timers, "setTimeout", (delayMs: number) => {
    assert.equal(delayMs, 50);
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  return async () => {
    release();
    await Promise.resolve();
  };
}

test("warm preparation waits for completed Changes and the highest writer sequence to become idle", async (t) => {
  const poll = seedPolling(t);
  const timings = [writerState(0, 0, 0)];
  const completed: string[] = [];
  const pending = prepareWarmSeed(seedRun(timings)).then((result) => {
    completed.push("ready");
    return result;
  });
  await Promise.resolve();
  assert.deepEqual(completed, []);
  timings.push(
    writerState(9, 1, 2),
    writerState(8, 0, 0),
    seedEvent("changes.classify", { event: "end", status: "ok", id: 4 }),
  );
  await poll();
  assert.deepEqual(completed, []);
  timings.push(writerState(10, 0, 0));
  await poll();
  const result = await pending;
  assert.deepEqual(completed, ["ready"]);
  assert.equal(result.storeState, "idle");
  assert.deepEqual(result.completion, timings[3]?.event);
  assert.deepEqual(result.states, [timings[4]?.event]);
});

test("legacy warm preparation waits for Changes and reports absent store state", async (t) => {
  const poll = seedPolling(t);
  const timings: TimingRecord[] = [];
  const completed: string[] = [];
  const pending = prepareWarmSeed(seedRun(timings)).then((result) => {
    completed.push("ready");
    return result;
  });
  await Promise.resolve();
  assert.deepEqual(completed, []);
  timings.push(
    seedEvent("changes.classify", { event: "end", status: "ok", id: 4 }),
  );
  await poll();
  const result = await pending;
  assert.equal(result.storeState, "not-observed");
  assert.deepEqual(result.completion, timings[0]?.event);
  assert.deepEqual(result.states, []);
});
