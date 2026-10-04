import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import {
  fingerprintInterleavingCase,
  interleavingKinds,
} from "./helpers/fingerprint_interleaving.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

test("eligible styles interleaved with instances keep fingerprints per view", async (context) => {
  const coverage: {
    kind: string;
    mode: string;
    path: string;
    fingerprintedViews: number;
  }[] = [];
  context.after(async () => {
    context.diagnostic(JSON.stringify(coverage));
    if (process.env.MOKLY_INTERLEAVING_COVERAGE)
      await fs.writeFile(
        process.env.MOKLY_INTERLEAVING_COVERAGE,
        JSON.stringify(coverage, null, 2) + "\n",
      );
  });
  for (const kind of interleavingKinds) {
    const fixture = await inlineChangesFixture(context, "", "", {
      ...fingerprintInterleavingCase(kind),
      colorSchemes: false,
    });
    for (const mode of ["committed", "derived"] as const) {
      const input = await pageFixtureInput(fixture, mode);
      const entry = input.after.entries.find(({ id }) => id === "home")!;
      for (const view of generatedViews(entry))
        await context.test(`${kind}/${mode}/${view.path}`, async () => {
          const events: TimingEvent[] = [];
          const prepared = await runWithTimings(
            true,
            "test",
            () =>
              runWithDocumentWork(async () =>
                fingerprintMaterials(input, true, "home", view.path),
              ),
            { write: (event) => events.push(event) },
          );
          assert.equal(prepared.inlineAnalysis?.status, "skipped");
          const counts = events.find(
            ({ stage, event }) =>
              stage === "review.document-work" && event === "counts",
          )!.counts!;
          coverage.push({
            kind,
            mode,
            path: view.path,
            fingerprintedViews: counts.fingerprintedViews!,
          });
          assert.deepEqual(
            await fingerprintComparison(input, true, "home", view.path),
            await fingerprintComparison(input, false, "home", view.path),
          );
          assert.equal(counts.fingerprintedViews, 1);
        });
    }
  }
});
