import assert from "node:assert/strict";

import type { TimingEvent } from "../../dist/diagnostics/timings.js";

const prefix = "[mokly:timing] ";
export const reviewStages = [
  "review.base-commit",
  "review.changed-paths",
  "review.base-manifest",
  "review.base-documents",
  "review.compare-screens",
  "review.resource-graph",
  "review.write-artifact",
];

export function timingEvents(stderr: string): TimingEvent[] {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => JSON.parse(line.slice(prefix.length)) as TimingEvent);
}

/** Assert complete, content-free spans and parentage within one process session. */
export function assertReviewTimings(
  events: readonly TimingEvent[],
  role: string,
  ancestor: string,
  stages = reviewStages,
): void {
  const review = events.filter((event) => event.stage.startsWith("review."));
  for (const stage of stages)
    assert.ok(
      review.some((event) => event.stage === stage),
      stage,
    );
  for (const event of review) {
    assert.ok(
      [...reviewStages, "review.css-analysis"].includes(event.stage),
      event.stage,
    );
    assert.equal(event.schemaVersion, 1);
    assert.equal(event.role, role);
    assert.ok(Number.isInteger(event.pid) && event.pid > 0);
    assert.ok(Number.isInteger(event.id) && event.id > 0);
    assert.ok(Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0);
    assert.ok(["start", "end", "counts"].includes(event.event));
    assert.deepEqual(
      Object.keys(event).sort(),
      [
        "schemaVersion",
        "session",
        "pid",
        "role",
        "stage",
        "id",
        "parentId",
        "elapsedMs",
        "event",
        ...(event.event === "end" ? ["durationMs", "status"] : []),
        ...(event.event === "counts" ? ["counts"] : []),
      ].sort(),
    );
    if (event.event === "counts") continue;
    if (event.event !== "start") continue;
    const session = events.filter((item) => item.session === event.session);
    const ends = session.filter(
      (item) => item.id === event.id && item.event === "end",
    );
    assert.equal(ends.length, 1, event.stage);
    const end = ends[0]!;
    assert.equal(end.stage, event.stage);
    assert.equal(end.parentId, event.parentId);
    assert.equal(end.status, "ok");
    assert.ok(Number.isFinite(end.durationMs) && end.durationMs! >= 0);
    assert.ok(end.elapsedMs >= event.elapsedMs);
    let parent = event.parentId;
    const ancestors: string[] = [];
    const seen = new Set<number>([event.id]);
    while (parent !== undefined) {
      assert.ok(!seen.has(parent), "acyclic parents");
      seen.add(parent);
      const start = session.find(
        (item) => item.id === parent && item.event === "start",
      );
      assert.ok(start, `parent for ${event.stage}`);
      assert.ok(start.elapsedMs <= event.elapsedMs);
      ancestors.push(start.stage);
      parent = start.parentId;
    }
    assert.ok(ancestors.includes(ancestor), `${event.stage} under ${ancestor}`);
  }
}

/** Assert the component-view path counts emitted once per classification loop. */
export function assertComparisonCounts(
  events: readonly TimingEvent[],
  role: string,
): void {
  const records = events.filter(
    (event) =>
      event.role === role &&
      event.stage === "review.compare-screens" &&
      event.event === "counts",
  );
  assert.equal(records.length, 1);
  const counts = records[0]?.counts;
  assert.deepEqual(Object.keys(counts ?? {}).sort(), [
    "completePath",
    "fastPath",
    "views",
  ]);
  assert.ok(
    [counts?.views, counts?.fastPath, counts?.completePath].every(
      (value) => Number.isInteger(value) && value! >= 0,
    ),
  );
  assert.equal(counts!.fastPath! + counts!.completePath!, counts!.views);
}
