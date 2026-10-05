import assert from "node:assert/strict";
import test from "node:test";

import { PageAnalysisPair } from "../dist/review/page_pair.js";

import {
  fingerprintComparison,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const mode of ["committed", "derived"] as const)
  test(`${mode} a resolved reference-bearing sheet cannot consume a skipped-style safety proof`, async (context) => {
    const style = '<style>.entry{background:url("../image.svg")}</style>';
    const markup = `<link rel="stylesheet" href="../shared.css">${style}`;
    const fixture = await inlineChangesFixture(context, markup, markup, {
      colorSchemes: false,
      files: {
        before: { "shared.css": ".missing{color:red}", "image.svg": "same" },
        after: { "shared.css": ".missing{color:blue}", "image.svg": "same" },
      },
    });
    const input = await pageFixtureInput(fixture, mode);
    assert.equal(
      fingerprintMaterials(input).inlineAnalysis?.status,
      "resolved",
    );
    const oracle = await fingerprintComparison(input, false);
    let scans = 0;
    const includes = String.prototype.includes;
    context.mock.method(
      String.prototype,
      "includes",
      function (this: string, needle: string, start?: number) {
        if (String(this) === style && needle === "<!--mokly-review-") scans++;
        return includes.call(this, needle, start);
      },
    );
    context.mock.method(PageAnalysisPair.prototype, "hasStyleSafetyProof", () =>
      assert.fail("resolved analysis must not query the skipped-style proof"),
    );
    assert.deepEqual(
      await fingerprintComparison(input, true, "home", undefined, {
        useFastPath: true,
        useStylePath: true,
      }),
      oracle,
    );
    assert.equal(scans, 3, "one quick scan and both complete guards");
  });
