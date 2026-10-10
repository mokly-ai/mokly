import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";
import { assertPageMaterialEquivalence } from "./helpers/page_material_oracle.js";

for (const mode of ["committed", "derived"] as const)
  test(`canonical appendix preserves authored marker lookalikes in ${mode}`, async (context) => {
    const fixture = await inlineChangesFixture(
      context,
      '<style>.entry::before{content:"<!--mokly-component:start:r-0-->";color:red}</style>',
      '<style>.entry::before{content:"";color:red}</style>',
      { colorSchemes: false },
    );
    const input = await pageFixtureInput(fixture, mode);
    await assertPageMaterialEquivalence(input);
    const old = await comparePageViews(input, true, false);
    const current = await comparePageViews(input, false, false);
    for (const result of current.filter(({ entryId }) => entryId === "home")) {
      const expected = old.find(({ path }) => path === result.path)!.comparison;
      assert.equal(
        expected.view.state,
        "unchanged",
        "M6 actual text strips the lookalike; projected appendix must retain it",
      );
      assert.deepEqual(expected.reasons, [{ kind: "material" }]);
      assert.deepEqual(result.comparison.view, expected.view);
      assert.deepEqual(result.comparison.reasons, expected.reasons);
    }
  });
