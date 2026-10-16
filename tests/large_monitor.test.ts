import assert from "node:assert/strict";
import test from "node:test";

import { monitor } from "../scripts/large/memory.js";
import type { MemorySystem } from "../scripts/large/memory.js";
import { killProcesses } from "../scripts/large/signals.js";

function memory(ps: () => Promise<string>) {
  const killed: number[] = [],
    failures: string[] = [];
  let samples = 0,
    schedules = 0,
    cancellations = 0;
  const boundary: MemorySystem = {
    pid: 10,
    ps: () => {
      samples++;
      return ps();
    },
    kill: (pid, signal) => {
      assert.equal(signal, "SIGKILL");
      killed.push(pid);
    },
    every: () => {
      schedules++;
      return () => {
        cancellations++;
      };
    },
  };
  return {
    boundary,
    killed,
    failures,
    fail: (message: string) => failures.push(message),
    counts: () => ({ samples, schedules, cancellations }),
  };
}

test("RSS threshold stops only the owned descendants across groups", async () => {
  const fake = memory(
    async () => "10 0 10 100\n20 10 20 200\n30 20 30 300\n40 0 40 9000",
  );
  const finish = monitor(20, fake.fail, 500, fake.boundary);
  await Promise.resolve();
  const result = await finish();
  assert.equal(result.peakKiB, 500);
  assert.equal(result.totalPeakKiB, 600);
  assert.deepEqual(fake.killed, [30, 20]);
  assert.match(fake.failures[0]!, /exceeded/);
});

test("RSS sampling failure signals only the valid child PID", async () => {
  const fake = memory(async () => {
    throw new Error("ps unavailable");
  });
  const finish = monitor(20, fake.fail, 500, fake.boundary);
  await Promise.resolve();
  await finish();
  assert.deepEqual(fake.killed, [20]);
  assert.match(fake.failures[0]!, /ps unavailable/);
});

test("a missing or unsafe PID starts no sampler and sends no signal", async () => {
  for (const pid of [undefined, -1, 0, 1, 10, NaN, Infinity, 2.5]) {
    const fake = memory(async () => {
      throw new Error("must not sample");
    });
    const result = await monitor(pid, fake.fail, 500, fake.boundary)();
    assert.equal(result.samples, 0);
    assert.deepEqual(fake.counts(), {
      samples: 0,
      schedules: 0,
      cancellations: 0,
    });
    assert.deepEqual(fake.killed, []);
    assert.deepEqual(fake.failures, []);
  }
});

test("every individual signal rejects sentinel and self PIDs", () => {
  const killed: number[] = [];
  killProcesses(
    [-1, 0, 1, 10, 2.5, NaN, Infinity, 20, 20],
    (pid) => {
      killed.push(pid);
    },
    10,
  );
  assert.deepEqual(killed, [20]);
});
