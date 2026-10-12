import assert from "node:assert/strict";
import test from "node:test";

import {
  comparisonMaterials,
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import {
  fingerprintOccurrenceCase,
  occurrenceKinds,
} from "./helpers/fingerprint_occurrence_cases.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const kind of occurrenceKinds)
  test(`skipped style duplicated in ${kind} preserves text equality`, async (context) => {
    const sample = fingerprintOccurrenceCase(kind);
    const fixture = await inlineChangesFixture(context, "", "", {
      ...sample,
      colorSchemes: false,
      renderer: {
        before: fingerprintRenderer(sample.before),
        after: fingerprintRenderer(sample.after),
      },
    });
    for (const mode of ["committed", "derived"] as const)
      await context.test(mode, async () => {
        const input = await pageFixtureInput(fixture, mode);
        assert.equal(
          fingerprintMaterials(input, false).inlineAnalysis?.status,
          "skipped",
        );
        const text = await fingerprintComparison(input, false);
        assert.equal(text.kind, "result");
        if (text.kind !== "result") return;
        assert.equal(text.result.view.state, "unchanged");
        assert.deepEqual(
          text.result.view.ignoredIds,
          kind === "paired-region" ? ["a", "b"] : [],
        );
        await assertGuardedMaterials(input, `${kind}/${mode}`);
      });
  });

test("identical style copies only at eligible positions keep in-place fingerprints", async (context) => {
  const style = "<style>.entry{color:red}</style>";
  const fixture = await inlineChangesFixture(
    context,
    style + style + '<meta name="before">',
    style + style + '<meta name="after">',
    { colorSchemes: false },
  );
  for (const mode of ["committed", "derived"] as const) {
    const input = await pageFixtureInput(fixture, mode);
    const prepared = fingerprintMaterials(input);
    assert.equal(prepared.inlineAnalysis?.status, "skipped");
    for (const material of comparisonMaterials(prepared))
      assert.equal(material.match(/<!--mokly-inline-style:/g)?.length, 2);
    assert.deepEqual(
      await fingerprintComparison(input, true),
      await fingerprintComparison(input, false),
    );
  }
});
