import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { runWithComparisonWork } from "../dist/diagnostics/material_timings.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponentsWithSources } from "../dist/review/component_classification_sources.js";

import {
  designLibraryFixture,
  snapshotReader,
} from "./helpers/design_library_fixture.js";

test("design catalogue keeps fingerprints on all complete-path views", async (context) => {
  const fixture = await designLibraryFixture(context);
  const coverage = [];
  for (const mode of ["committed", "derived"] as const) {
    const events: TimingEvent[] = [];
    const classify = (useMaterialFingerprints: boolean) =>
      classifyComponentsWithSources({
        before: fixture.before.manifest,
        after: fixture.before.manifest,
        beforeReader: snapshotReader(fixture.before, fixture.resources),
        afterReader: snapshotReader(fixture.before, fixture.resources),
        config: { ...fixture.config, generatedOutput: mode },
        changedPaths: [],
        baseCommit: "a".repeat(40),
        baseRef: "main",
        useFastPath: false,
        useStylePath: false,
        useMaterialFingerprints,
      });
    const result = await runWithTimings(
      true,
      "test",
      () => runWithComparisonWork(() => classify(true), true),
      {
        write: (event) => events.push(event),
      },
    );
    assert.deepEqual(result, await classify(false));
    const counts = events.find(
      ({ stage, event }) =>
        stage === "review.material-work" && event === "counts",
    )!.counts!;
    const paths = events.find(
      ({ stage, event }) =>
        stage === "review.compare-screens" && event === "counts",
    )!.counts!;
    assert.equal(paths.views, 460);
    assert.equal(paths.completePath, 460);
    assert.equal(counts.fingerprintedViews, 460);
    coverage.push({
      mode,
      views: paths.views,
      fingerprintedViews: counts.fingerprintedViews,
    });
  }
  context.diagnostic(JSON.stringify(coverage));
  if (process.env.MOKLY_DESIGN_FINGERPRINT_COVERAGE)
    await fs.writeFile(
      process.env.MOKLY_DESIGN_FINGERPRINT_COVERAGE,
      JSON.stringify(coverage, null, 2) + "\n",
    );
});
