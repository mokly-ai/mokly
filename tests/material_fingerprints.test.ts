import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { stripComponentMarkers } from "../dist/components/comparison_material.js";
import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../dist/review/ignore.js";

import {
  assertFingerprintComparison,
  comparisonMaterials,
  fingerprintMaterials,
} from "./helpers/fingerprint_comparison.js";
import { inlineMaterialReplacements as textRendering } from "./helpers/inline_m8_rendering.js";
import { styleRouteFixture, withHeadStyles } from "./helpers/style_route.js";

const digest = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("base64url");

for (const mode of ["committed", "derived"] as const)
  test(`fingerprinted materials preserve M8 comparisons in ${mode}`, async (context) => {
    const fixture = await styleRouteFixture(context);
    for (const [name, before, after] of [
      [
        "entry",
        '.entry{content:"café😀";color:red}',
        '.entry{content:"café😀";color:blue}',
      ],
      ["owned", ".action{color:red}", ".action{color:blue}"],
      ["empty retained", ".missing{color:red}", ".missing{color:blue}"],
      [
        "multiplicity",
        ".entry{color:red}.entry{color:red}",
        ".entry{color:red}",
      ],
    ])
      await context.test(name!, async () => {
        const input = withHeadStyles(
          fixture,
          `<style>${before}</style>`,
          `<style>${after}</style>`,
          mode,
        );
        const prepared = fingerprintMaterials(input);
        const analysis = prepared.inlineAnalysis!;
        assert.equal(analysis.status, "resolved");
        const materials = comparisonMaterials(prepared);
        for (const [index, side, kind] of [
          [0, "before", "actual"],
          [1, "after", "actual"],
          [2, "before", "projected"],
          [3, "after", "projected"],
        ] as const) {
          const canonical: string = textRendering(analysis, side)[
            kind
          ].appendix.slice(7, -8);
          const comment: string = `<!--mokly-inline-rules:${digest(canonical)}-->`;
          assert.ok(materials[index]!.endsWith(comment), `${side}/${kind}`);
          assert.match(
            comment,
            /^<!--mokly-inline-rules:[A-Za-z0-9_-]{43}-->$/,
          );
          assert.equal(stripComponentMarkers(comment), comment);
          assert.equal(normalizeSingleDocument(comment, "test"), comment);
          assert.equal(
            normalizeReviewPair(comment, comment, "test").base,
            comment,
          );
          if (name === "empty retained") assert.equal(canonical, "");
        }
        assert.deepEqual(
          prepared.references,
          fingerprintMaterials(input, false).references,
        );
        await assertFingerprintComparison(input);
      });

    await context.test(
      "skipped elements keep complete source identity and position",
      async () => {
        const style = '<style data-label="café">.entry{color:red}</style>';
        const input = withHeadStyles(
          fixture,
          style + "<meta name=kept>",
          "<meta name=kept>" + style,
          mode,
        );
        const prepared = fingerprintMaterials(input);
        assert.equal(prepared.inlineAnalysis?.status, "skipped");
        const marker = `<!--mokly-inline-style:${digest(style)}-->`;
        const [base, head] = comparisonMaterials(prepared);
        assert.ok(base!.includes(marker + "<meta name=kept>"));
        assert.ok(head!.includes("<meta name=kept>" + marker));
        assert.notEqual(base, head);
        const comparison = await assertFingerprintComparison(input);
        assert.equal(comparison.kind, "result");
        if (comparison.kind === "result") {
          assert.equal(comparison.result.view.state, "changed");
          assert.equal(comparison.result.view.material, true);
        }
      },
    );

    await context.test(
      "parse failure retains both text materials verbatim",
      async () => {
        const input = withHeadStyles(
          fixture,
          "<style>.entry{color:red</style>",
          "<style>.entry{color:blue}</style>",
          mode,
        );
        const current = fingerprintMaterials(input);
        const old = fingerprintMaterials(input, false);
        assert.equal(current.inlineAnalysis?.status, "unresolved");
        assert.deepEqual(current.projected, old.projected);
        for (const material of comparisonMaterials(current))
          assert.ok(!material.includes("mokly-inline-"));
        await assertFingerprintComparison(input);
      },
    );
  });
