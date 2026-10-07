import assert from "node:assert/strict";
import test from "node:test";

import {
  inlineMaterialReferences,
  inlineMaterialReplacements,
} from "../dist/review/css/inline_rendering.js";

import { fingerprintMaterials } from "./helpers/fingerprint_comparison.js";
import {
  inlineMaterialReferences as deliveredReferences,
  inlineMaterialReplacements as delivered,
} from "./helpers/inline_m8_rendering.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

test("text-material switch retains the frozen M8 renderer", async (context) => {
  const fixture = await styleRouteFixture(context);
  const cases = [
    ["resolved", ".entry{color:red}", ".entry{color:blue}"],
    ["skipped", ".entry{color:red}", ".entry{color:red}"],
    ["unresolved", ".entry{color:red", ".entry{color:blue}"],
    [
      "resolved",
      '.entry{background:url("../asset.svg")}',
      '.entry{background:url("../other.svg")}',
    ],
  ] as const;
  for (const [status, before, after] of cases)
    await context.test(`${status}: ${before}`, () => {
      const input = withHeadStyles(
        fixture,
        `<style>${before}</style>`,
        `<style>${after}</style>`,
      );
      const analysis = fingerprintMaterials(input, false).inlineAnalysis;
      assert.ok(analysis);
      assert.equal(analysis.status, status);
      for (const side of ["before", "after"] as const) {
        const actual = inlineMaterialReplacements(analysis, side);
        const expected = delivered(analysis, side);
        assert.deepEqual(actual, expected);
        for (const kind of ["actual", "projected"] as const)
          assert.deepEqual(
            inlineMaterialReferences(actual[kind]),
            deliveredReferences(expected[kind]),
          );
      }
    });
});
