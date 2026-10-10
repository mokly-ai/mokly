import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock } from "node:test";

const original = await import("../../dist/diagnostics/material_work.js");
const input = JSON.parse(await fs.readFile(process.argv[2], "utf8"));
input.beforeFiles = new Map(input.beforeFiles);
input.afterFiles = new Map(input.afterFiles);
let constructions = 0;
const calls = {};
class CountedMaterialWork extends original.MaterialWork {
  constructor() {
    super();
    constructions++;
  }
}
for (const name of Object.getOwnPropertyNames(
  original.MaterialWork.prototype,
)) {
  if (name === "constructor") continue;
  const method = original.MaterialWork.prototype[name];
  CountedMaterialWork.prototype[name] = function (...args) {
    calls[name] = (calls[name] ?? 0) + 1;
    return Reflect.apply(method, this, args);
  };
}
mock.module(
  new URL("../../dist/diagnostics/material_work.js", import.meta.url).href,
  {
    namedExports: { MaterialWork: CountedMaterialWork },
  },
);
const { runWithComparisonWork, timingMaterialWork } =
  await import("../../dist/diagnostics/material_timings.js");
const { runWithTimings } = await import("../../dist/diagnostics/timings.js");
const { comparePageViews } = await import("./page_comparison.ts");
const { ViewResourceCache } =
  await import("../../dist/review/view_resources.js");
const enabled = process.env.MOKLY_MATERIAL_WORK === "1";
const timings = process.argv[3] !== "disabled";
const events = [];
const comparisons = await runWithTimings(
  timings,
  "probe",
  () =>
    runWithComparisonWork(async () => {
      assert.equal(Boolean(timingMaterialWork()), enabled && timings);
      const results = await comparePageViews(input, false, false);
      const cache = new ViewResourceCache(
        async () => new Set(),
        async () => new Set(),
      );
      await cache.resources(
        "probe.html",
        input.afterFiles.values().next().value,
      );
      return results;
    }),
  { write: (event) => events.push(event) },
);
assert(
  comparisons.every(
    ({ comparison }) => comparison.comparisonPath === "complete",
  ),
);
if (!enabled || !timings) {
  assert.equal(constructions, 0, "detail-off constructed MaterialWork");
  assert.deepEqual(
    calls,
    {},
    "detail-off called material/byte collector methods",
  );
  assert(!events.some((event) => event.stage === "review.material-work"));
} else {
  assert.equal(constructions, 1);
  for (const name of [
    "normalization",
    "material",
    "materials",
    "materialHash",
    "inlineFingerprint",
    "fingerprintedView",
    "fingerprintSeam",
    "record",
  ])
    assert(calls[name] > 0, `Missing positive probe control: ${name}`);
}
process.stdout.write(
  JSON.stringify({ constructions, calls, comparisons }, (_key, value) =>
    value instanceof Set ? [...value].sort() : value,
  ),
);
