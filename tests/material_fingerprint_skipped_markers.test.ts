import assert from "node:assert/strict";
import test from "node:test";

import { fingerprintMaterials } from "./helpers/fingerprint_comparison.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const start = "<!--mokly-review-ignore:start:a-->";
const end = "<!--mokly-review-ignore:end:a-->";
const signal = `<!--mokly-review-material:a:${"a".repeat(64)}-->`;
for (const mode of ["committed", "derived"] as const)
  for (const location of ["content", "attribute"])
    for (const marker of ["region", "signal"]) {
      test(`skipped ${marker} in style ${location} keeps text: ${mode}`, async (context) => {
        const text = marker === "region" ? start : signal;
        const style =
          location === "content"
            ? `<style>.entry{color:red}/*${text}*/</style>`
            : `<style data-review="${text}">.entry{color:red}</style>`;
        const outside =
          marker === "region" ? `VALUE${end}` : `${start}VALUE${end}`;
        const fixture = await inlineChangesFixture(
          context,
          style + outside.replace("VALUE", "old"),
          style + outside.replace("VALUE", "new"),
          { colorSchemes: false },
        );
        const input = await pageFixtureInput(fixture, mode);
        assert.equal(
          fingerprintMaterials(input, false).inlineAnalysis?.status,
          "skipped",
        );
        await assertGuardedMaterials(input, `${marker}/${location}`);
      });
    }
