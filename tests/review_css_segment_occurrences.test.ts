import assert from "node:assert/strict";
import test from "node:test";

import { inlineMaterialReplacements } from "../src/review/css/inline_rendering.js";

import { assertUniqueOccurrences } from "./helpers/inline_analysis_oracle.js";
import { attributeInlineRules as reference } from "./helpers/inline_m4_attribution.js";
import { inlineMaterialReplacements as referenceMaterials } from "./helpers/inline_m4_rendering.js";
import { analyzeInline, html, resolved } from "./helpers/inline_styles.js";

test("an unmatched custom-property reference copy survives an excluded matched copy", () => {
  const rule = '.missing{--tone:red;background:url("image.svg")}';
  const { input, result } = analyzeInline({
    before: html(`<style>${rule}</style>`, ""),
    after: html(`<style>${rule}${rule}</style>`, ""),
  });
  const value = resolved(result);
  assert.deepEqual(
    value.rules.map(({ change, attribution }) => [
      change.kind,
      attribution.kind,
    ]),
    [
      ["added", "unresolved"],
      ["unchanged", "excluded"],
    ],
  );
  assert.equal(value.rules[0]!.change.after?.ordinal, 1);
  assert.equal(value.rules[1]!.change.after?.ordinal, 0);
  for (const side of ["before", "after"] as const) {
    const ordinals = value.rules.flatMap(({ change }) =>
      change[side] ? [change[side]!.ordinal] : [],
    );
    assert.equal(new Set(ordinals).size, ordinals.length);
  }
  assert.equal(
    inlineMaterialReplacements(result, "before").actual.appendix,
    "<style></style>",
  );
  const materials = inlineMaterialReplacements(result, "after");
  assert.match(materials.actual.appendix, /--tone:red/);
  assert.equal(materials.actual.appendix, materials.projected.appendix);
  const old = reference(input);
  assert.equal(
    referenceMaterials(old, "after").actual.appendix,
    "<style></style>",
  );
});

for (const counts of [
  [2, 2],
  [2, 3],
  [3, 2],
] as const)
  test(`${counts[0]} to ${counts[1]} reference copies are paired earliest first exactly once`, () => {
    const rule = '.entry{background:url("image.svg")}';
    const { result } = analyzeInline({
      before: html(
        `<style>${rule.repeat(counts[0])}</style>`,
        '<main class="entry"></main>',
      ),
      after: html(
        `<style>${rule.repeat(counts[1])}</style>`,
        '<main class="entry"></main>',
      ),
    });
    const value = resolved(result);
    assertUniqueOccurrences(value);
    const paired = value.rules.filter(
      ({ change }) => change.kind === "unchanged",
    );
    assert.deepEqual(
      paired.map(({ change }) => [
        change.before?.ordinal,
        change.after?.ordinal,
      ]),
      Array.from({ length: Math.min(...counts) }, (_, ordinal) => [
        ordinal,
        ordinal,
      ]),
    );
    assert.equal(value.rules.length, Math.max(...counts));
    assert.equal(
      value.retainedSelectors?.status,
      counts[0] === counts[1] ? undefined : "matched",
    );
    assert.equal(value.ownedComponentIds.size, 0);
  });
