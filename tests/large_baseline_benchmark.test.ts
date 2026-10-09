import assert from "node:assert/strict";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { resetFixtureBaseline } from "../scripts/large/baseline.mjs";
import {
  baselineMeasurement,
  timingCollector,
  type ReceivedTiming,
} from "../scripts/large/timings.mjs";

import { baselineFixture } from "./helpers/baseline_fixture.js";

test("a cold benchmark reset clears only the pinned baseline and rejects held locks", async () => {
  const { builder, request, fs, runner, clock } = baselineFixture();
  await builder.build(request);
  await builder.build({ ...request, commit: "b".repeat(40) });
  const config = {
    repoRoot: request.repoRoot,
    review: { base: "main", outDir: ".review" },
  };
  const evidence = {
    mergeBase: async () => request.commit,
    changedPaths: async () => [],
  };
  const layout = cacheLayout(request.repoRoot, request.commit);
  fs.put(layout.lock, "regular", Buffer.from('{"pid":42}'));
  await assert.rejects(
    resetFixtureBaseline(config, { fs, runner, clock, evidence }),
    /active baseline/,
  );
  assert.ok(await fs.stat(layout.marker));
  await fs.remove(layout.lock);
  await resetFixtureBaseline(config, { fs, runner, clock, evidence });
  assert.equal(await fs.stat(layout.marker), undefined);
  assert.equal(await fs.stat(layout.lock), undefined);
  assert.ok(
    await fs.stat(cacheLayout(request.repoRoot, "b".repeat(40)).marker),
  );
});

function completion(cacheHit: boolean): ReceivedTiming {
  return {
    receivedMs: 150,
    event: {
      schemaVersion: 1,
      session: "baseline-test",
      pid: 1,
      role: "test",
      stage: "baseline",
      event: "end",
      id: 1,
      elapsedMs: 9999,
      durationMs: cacheHit ? 5 : 90,
      status: "ok",
      cacheHit,
    },
  };
}

test("benchmark timing records survive chunk splits and use the observer's clock", () => {
  const collector = timingCollector(() => 150);
  collector.accept("[mokly:timing] not JSON\n[mokly:timing] null\n");
  const event = completion(true).event;
  const line = `[mokly:timing] ${JSON.stringify(event)}\n`;
  collector.accept("ordinary output\n" + line.slice(0, 30));
  assert.equal(collector.records.length, 0);
  collector.accept(new Uint8Array(Buffer.from(line.slice(30))));
  assert.deepEqual(baselineMeasurement(collector.records, 100, true), {
    cacheHit: true,
    baselineMs: 5,
    baselineReadyMs: 50,
    preparingToPendingMs: 0,
    baselinePhases: [],
  });
});

test("the benchmark rejects missing, failed, mislabeled and unadopted baselines", () => {
  const cold = completion(false);
  const adopt: ReceivedTiming = {
    receivedMs: 140,
    event: {
      ...cold.event,
      stage: "baseline.adopt",
      id: 2,
      parentId: 1,
      durationMs: 10,
    },
  };
  const measured = baselineMeasurement([adopt, cold], 100, false);
  assert.equal(measured.preparingToPendingMs, 90);
  assert.deepEqual(measured.baselinePhases, [
    { stage: "baseline.adopt", durationMs: 10 },
  ]);
  for (const records of [
    [],
    [cold],
    [cold, cold],
    [completion(true)],
    [adopt, { ...cold, event: { ...cold.event, status: "error" as const } }],
  ])
    assert.throws(() => baselineMeasurement(records, 100, false));
  assert.throws(() =>
    baselineMeasurement([adopt, completion(true)], 100, true),
  );
});
