import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { runWithComparisonWork } from "../dist/diagnostics/material_timings.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponentsWithSources } from "../dist/review/component_classification_sources.js";

import { memoryReader } from "./helpers/component_fast_path.js";
import { styleRouteLargeFixture } from "./helpers/style_route_large.js";

test("ordinary RNW fixtures retain complete-path fingerprints and exact text-oracle results", async (context) => {
  const coverage = [];
  for (const cumulative of [false, true]) {
    const fixture = await styleRouteLargeFixture(context, cumulative);
    for (const mode of ["committed", "derived"] as const)
      for (const scenario of ["no-changes", "component-style"]) {
        const identical = scenario === "no-changes";
        const classify = (useMaterialFingerprints: boolean) =>
          classifyComponentsWithSources({
            before: fixture.before,
            after: identical ? fixture.before : fixture.after,
            beforeReader: memoryReader(fixture.beforeFiles),
            afterReader: memoryReader(
              identical ? fixture.beforeFiles : fixture.afterFiles,
            ),
            config: fixture.config,
            changedPaths: identical ? [] : fixture.changedPaths,
            baseCommit: "a".repeat(40),
            baseRef: "main",
            useFastPath: false,
            useStylePath: false,
            useMaterialFingerprints,
          });
        const events: TimingEvent[] = [];
        const actual = await runWithTimings(
          true,
          "test",
          () => runWithComparisonWork(() => classify(true), true),
          { write: (event) => events.push(event) },
        );
        assert.deepEqual(actual, await classify(false));
        const counts = events.find(
          ({ stage, event }) =>
            stage === "review.material-work" && event === "counts",
        )!.counts!;
        const paths = events.find(
          ({ stage, event }) =>
            stage === "review.compare-screens" && event === "counts",
        )!.counts!;
        assert.equal(paths.views, 64);
        assert.equal(paths.completePath, 64);
        assert.equal(counts.fingerprintedViews, 64);
        coverage.push({
          cumulative,
          mode,
          scenario,
          fingerprintedViews: counts.fingerprintedViews,
          hashes: counts.inlineFingerprintHashes,
        });
      }
  }
  context.diagnostic(JSON.stringify(coverage));
  if (process.env.MOKLY_FINGERPRINT_COVERAGE)
    await fs.writeFile(
      process.env.MOKLY_FINGERPRINT_COVERAGE,
      JSON.stringify(coverage, null, 2) + "\n",
    );
});
