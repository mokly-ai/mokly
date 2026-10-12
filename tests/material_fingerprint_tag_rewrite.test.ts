import assert from "node:assert/strict";
import test from "node:test";

import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { assertGuardedMaterials } from "./helpers/fingerprint_guard_assertions.js";
import {
  fingerprintTagRewriteCase,
  tagRewriteKinds,
} from "./helpers/fingerprint_tag_rewrite.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const kind of tagRewriteKinds)
  test(`skipped ${kind} styles retain text when their tags lose component markers`, async (context) => {
    const fixture = await inlineChangesFixture(context, "", "", {
      ...fingerprintTagRewriteCase(kind),
      colorSchemes: false,
    });
    for (const mode of ["committed", "derived"] as const)
      await context.test(mode, async () => {
        const input = await pageFixtureInput(fixture, mode);
        assert.equal(
          fingerprintMaterials(input, false).inlineAnalysis?.status,
          "skipped",
        );
        const oracle = await fingerprintComparison(input, false);
        assert.equal(oracle.kind, "result");
        if (oracle.kind === "result")
          assert.equal(oracle.result.view.state, "unchanged");
        await assertGuardedMaterials(input, `${kind}/${mode}`);
      });
  });
