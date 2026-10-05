import assert from "node:assert/strict";
import test from "node:test";

import { runWithComparisonWork } from "../dist/diagnostics/material_timings.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ViewResourceCache } from "../dist/review/view_resources.js";

import {
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { pageContext } from "./helpers/page_comparison.js";
import {
  selectedStyleViews,
  styleRouteFixture,
  withHeadStyles,
} from "./helpers/style_route.js";

async function work(operation: () => Promise<unknown>) {
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    () => runWithComparisonWork(operation, true),
    {
      write: (event) => events.push(event),
    },
  );
  return events.find(
    ({ stage, event }) =>
      stage === "review.material-work" && event === "counts",
  )!.counts!;
}

for (const mode of ["committed", "derived"] as const)
  for (const skipped of [false, true])
    test(`${mode} complete material work stays bounded for N and N+1 rules, skipped=${skipped}`, async (context) => {
      const fixture = await styleRouteFixture(context);
      const samples = [];
      for (const size of [256, 257]) {
        const sheet = Array.from(
          { length: size },
          (_, index) => `.entry[data-rule="${index}"]{z-index:${index}}`,
        ).join("");
        const input = withHeadStyles(
          fixture,
          `<style>${sheet}.entry{color:red}</style><meta name="before">`,
          `<style>${sheet}.entry{color:${skipped ? "red" : "blue"}}</style><meta name="after">`,
          mode,
        );
        const { before, after, root } = selectedStyleViews(input);
        const counts = await work(async () => {
          const result = await compareComponentView(
            {
              ...pageContext(input),
              useFastPath: false,
              useStylePath: false,
            },
            before,
            after,
            root,
          );
          assert.equal(result.comparisonPath, "complete");
        });
        const materials = comparisonMaterials(fingerprintMaterials(input));
        const text = comparisonMaterials(fingerprintMaterials(input, false));
        const hash = await work(async () => {
          for (const html of materials) {
            const cache = new ViewResourceCache(
              async () => new Set(),
              async () => new Set(),
            );
            await cache.resources("screens/home.html", html);
          }
        });
        assert.ok(counts.materialBytes! > 0);
        assert.ok(counts.materialNormalizationBytes! > 0);
        assert.ok(counts.inlineFingerprintHashes! > 0);
        assert.ok(counts.fingerprintSeams! > 0);
        assert.ok(
          counts.fingerprintSeamUnits! <= 24 * counts.fingerprintSeams!,
        );
        assert.equal(
          hash.materialHashBytes,
          materials.reduce((sum, value) => sum + Buffer.byteLength(value), 0),
        );
        samples.push({
          counts,
          lengths: materials.map((value) => value.length),
          hash: hash.materialHashBytes,
          textLength: text.reduce((sum, value) => sum + value.length, 0),
        });
      }
      const [n, next] = samples;
      assert.deepEqual(n!.lengths, next!.lengths);
      for (const field of [
        "materialBytes",
        "materialNormalizationBytes",
        "materialHashBytes",
        "fingerprintSeams",
        "fingerprintSeamUnits",
      ])
        assert.equal(n!.counts[field], next!.counts[field], field);
      assert.equal(n!.hash, next!.hash);
      assert.ok(next!.textLength > n!.textLength, "the text oracle must grow");
      assert.ok(
        next!.counts.inlineFingerprintBytes! >
          n!.counts.inlineFingerprintBytes!,
        "digest inputs still grow and must remain separately visible",
      );
      assert.equal(
        next!.counts.sourceNormalizationBytes,
        n!.counts.sourceNormalizationBytes,
        "complete preparation must not normalize the original sheet",
      );
    });

for (const mode of ["committed", "derived"] as const)
  test(`a routed ${mode} view does no material or fingerprint work`, async (context) => {
    const fixture = await styleRouteFixture(context);
    const input = withHeadStyles(
      fixture,
      "<style>.entry{color:red}</style>",
      "<style>.entry{color:blue}</style>",
      mode,
    );
    const { before, after, root } = selectedStyleViews(input);
    const counts = await work(async () => {
      const result = await compareComponentView(
        pageContext(input),
        before,
        after,
        root,
      );
      assert.equal(result.comparisonPath, "style");
    });
    for (const field of [
      "materialBytes",
      "materialNormalizationBytes",
      "materialHashBytes",
      "inlineFingerprintHashes",
      "inlineFingerprintBytes",
      "fingerprintedViews",
      "fingerprintSeams",
      "fingerprintSeamUnits",
    ])
      assert.equal(counts[field], 0, field);
  });
