import assert from "node:assert/strict";
import childProcess from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";

import type { AcceptanceBuild } from "../scripts/large/acceptance_build.js";
import { benchmark } from "../scripts/large/benchmark.js";
import {
  buildLiveness,
  buildLivenessMessage,
  completeLineObserver,
  outputLiveness,
  reservationPath,
  type LivenessTimer,
} from "../scripts/large/build_liveness.js";

import { generateLargeFixture } from "./fixtures/large/generate.js";
import { repositoryRoot } from "./helpers/fixture.js";

interface Entry {
  callback: () => void;
  cancelled: boolean;
}

class ManualTimer implements LivenessTimer {
  entries: Entry[] = [];

  schedule(callback: () => void, delayMs: number) {
    assert.equal(delayMs, 300_000);
    const entry: Entry = { callback, cancelled: false };
    this.entries.push(entry);
    return () => {
      entry.cancelled = true;
    };
  }

  fire(entry: Entry) {
    if (!entry.cancelled) entry.callback();
  }
}

const acceptanceBuild: AcceptanceBuild = {
  profile: "release",
  target: "test-target",
  binarySha256: "b".repeat(64),
  sourceCommit: "test-commit",
  sourceTree: "test-tree",
  dirty: false,
};

async function fixtureWithCli(
  t: { after(callback: () => void): void },
  source = "setInterval(() => {}, 1000);",
) {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/large-build-liveness-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await generateLargeFixture(root, {
    areas: 1,
    screens: 2,
    rows: 1,
  });
  await fs.mkdir(path.join(root, ".context"));
  const cli = path.join(root, "node_modules/@mokly/mokly/bin/mokly.mjs");
  await fs.mkdir(path.dirname(cli), { recursive: true });
  await fs.writeFile(cli, source);
  return {
    ...fixture,
    toolchain: { mode: "workspace" as const, installMs: null },
    baseline: "test",
    setupMs: 0,
  };
}

test("a complete line before each window keeps a build running across several windows", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let complete = () => {};
  const done = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let stopped = 0;
  const liveness = buildLiveness({ done }, "/fixture", 300_000, async () => {
    stopped++;
    complete();
  });
  const pending = liveness.wait();
  const stdout = completeLineObserver(liveness.line);
  const stderr = completeLineObserver(liveness.line);
  for (let window = 0; window < 4; window++) {
    t.mock.timers.tick(299_999);
    (window % 2 === 0 ? stdout : stderr)(Buffer.from("progress\n"));
    assert.equal(stopped, 0);
  }
  complete();
  await pending;
  t.mock.timers.tick(300_000);
  assert.equal(stopped, 0);
});

test("a silent build expires its liveness window", () => {
  const timer = new ManualTimer();
  let expired = 0;
  outputLiveness(300_000, () => expired++, timer);

  timer.fire(timer.entries[0]!);

  assert.equal(expired, 1);
});

test("liveness observes complete lines split across either output stream", () => {
  let lines = 0;
  const stdout = completeLineObserver(() => lines++);
  const stderr = completeLineObserver(() => lines++);

  stdout(Buffer.from("first"));
  stdout(Buffer.from(" line\nsecond\npartial"));
  stderr(Buffer.from("error\n"));
  stderr(Buffer.from("line"));

  assert.equal(lines, 3);
});

test("liveness failure names an existing reservation and omits an absent one", async () => {
  const root = "/fixture";
  const lock = reservationPath(root);
  const held = await buildLivenessMessage(root, 300_000, async (file) => {
    assert.equal(file, lock);
    return true;
  });
  const clear = await buildLivenessMessage(root, 300_000, async (file) => {
    assert.equal(file, lock);
    return false;
  });

  assert.match(held, /Build wrote no output line for 300 seconds/);
  assert.match(held, new RegExp(`Inspect.*${lock}.*remove`));
  assert.doesNotMatch(clear, /mokly-static/);
});

test("a silent build reports liveness and its reservation path", async (t) => {
  const fixture = await fixtureWithCli(t);
  const lock = reservationPath(fixture.root);
  await fs.mkdir(lock, { recursive: true });
  const timer = new ManualTimer();
  const pending = benchmark(fixture, ["build"], 1, {
    memoryStopKiB: 0,
    acceptanceForFixture: async () => acceptanceBuild,
    buildLivenessTimer: timer,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  timer.fire(timer.entries[0]!);

  await assert.rejects(
    pending,
    new RegExp(
      `Build wrote no output line for 300 seconds.*Inspect.*${lock}.*remove`,
    ),
  );
  const report = JSON.parse(
    await fs.readFile(
      path.join(fixture.root, ".context/measurements.json"),
      "utf8",
    ),
  );
  const result = report.results[0];
  assert.ok(result && typeof result === "object" && "reason" in result);
  assert.match(String(result.reason), /harness liveness limit/);
  assert.ok((await fs.stat(lock)).isDirectory());
});

test("builds share acceptance and forward complete lines from both output streams", async (t) => {
  const fixture = await fixtureWithCli(
    t,
    "process.stdout.write('one\\ntwo\\npartial'); process.stderr.write('three\\nfour\\npartial');",
  );
  const timer = new ManualTimer();
  let acceptanceCalls = 0;
  const report = await benchmark(fixture, ["build", "build"], 1, {
    memoryStopKiB: 0,
    acceptanceForFixture: async () => {
      acceptanceCalls++;
      return acceptanceBuild;
    },
    buildLivenessTimer: timer,
  });

  assert.equal(acceptanceCalls, 1);
  assert.equal(report.results.length, 2);
  for (const result of report.results) {
    assert.ok(result && "status" in result && "acceptanceBuild" in result);
    assert.equal(result.status, "measured");
    assert.deepEqual(result.acceptanceBuild, acceptanceBuild);
  }
  assert.equal(timer.entries.length, 10);
  assert.ok(timer.entries.every((entry) => entry.cancelled));
});

test("SIGKILL after a liveness expiry still reports the liveness message", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const fixture = await fixtureWithCli(
    t,
    "process.on('SIGTERM', () => {}); process.stderr.write('ready\\n'); setInterval(() => {}, 1000);",
  );
  let spawned = (_child: ChildProcess) => {};
  const started = new Promise<ChildProcess>((resolve) => {
    spawned = resolve;
  });
  const spawn = childProcess.spawn;
  t.mock.method(childProcess, "spawn", (...args: Parameters<typeof spawn>) => {
    const child = spawn(...args);
    child.once("spawn", () => spawned(child));
    return child;
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  const pending = assert.rejects(
    benchmark(fixture, ["build"], 1, {
      memoryStopKiB: 0,
      acceptanceForFixture: async () => acceptanceBuild,
    }),
    {
      message:
        "Build wrote no output line for 300 seconds, the harness liveness limit.",
    },
  );
  const child = await started;
  assert.ok(child.stderr);
  await once(child.stderr, "data");
  t.mock.timers.tick(299_999);
  assert.equal(child.signalCode, null);
  t.mock.timers.tick(1);
  t.mock.timers.tick(10_000);
  await pending;
  assert.equal(child.signalCode, "SIGKILL");
});
