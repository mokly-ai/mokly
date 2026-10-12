import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { fingerprintMaterials } from "./helpers/fingerprint_comparison.js";
import { fingerprintRenderer } from "./helpers/fingerprint_fixture.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const duplicate of ["before", "after"] as const)
  test(`a non-replaced skipped-style copy on only ${duplicate} keeps all text materials`, async (context) => {
    const style = "<style>.entry{color:red}</style>";
    const tail = `<textarea>${style}</textarea>`;
    const fixture = await inlineChangesFixture(context, "", "", {
      colorSchemes: false,
      source: componentEntrySource({ body: "<p>Ordinary</p>" }),
      renderer: {
        before: fingerprintRenderer(style, duplicate === "before" ? tail : ""),
        after: fingerprintRenderer(style, duplicate === "after" ? tail : ""),
      },
    });
    for (const mode of ["committed", "derived"] as const) {
      const input = await pageFixtureInput(fixture, mode);
      assert.equal(
        fingerprintMaterials(input, false).inlineAnalysis?.status,
        "skipped",
      );
      await assertGuardedMaterials(input, `${duplicate}/${mode}`);
    }
  });
