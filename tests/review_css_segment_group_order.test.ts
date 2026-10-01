import assert from "node:assert/strict";
import test from "node:test";

import { attributeInlineRules } from "../src/review/css/inline_attribution.js";
import { inlineMaterialReplacements } from "../src/review/css/inline_rendering.js";

import { assertUniqueOccurrences } from "./helpers/inline_analysis_oracle.js";
import { attributeInlineRules as reference } from "./helpers/inline_m4_attribution.js";
import { inlineMaterialReplacements as referenceMaterials } from "./helpers/inline_m4_rendering.js";
import { html, inlineInput, resolved } from "./helpers/inline_styles.js";

test("grouped agreeing survivors preserve value diffs and materials while global change order differs", () => {
  const group = "@media screen{.a{color:red}.b{color:black}}";
  const input = inlineInput({
    before: html(
      `<style>${group}@media screen{.a{color:green}}@media screen{.c{color:yellow}}</style>`,
      '<main class="a c"></main>',
    ),
    after: html(
      `<style>@media screen{.a{color:red}}@media screen{.c{color:purple}}${group}@media screen{.a{color:blue}}</style>`,
      '<main class="a c"></main>',
    ),
  });
  const actual = resolved(attributeInlineRules(input));
  const expected = reference(input);
  assert.ok(expected.status === "resolved");
  const pairs = (value: typeof expected) =>
    value.rules.map(({ change }) => [
      change.kind,
      change.before?.ordinal,
      change.after?.ordinal,
    ]);
  assert.deepEqual(pairs(actual), [
    ["added", undefined, 4],
    ["changed", 2, 0],
    ["changed", 3, 1],
  ]);
  assert.deepEqual(pairs(expected), [
    ["added", undefined, 4],
    ["changed", 3, 1],
    ["changed", 2, 2],
  ]);
  const values = (value: typeof expected) =>
    value.rules
      .map(({ change, attribution, selectors }) => ({
        kind: change.kind,
        from: change.before?.declarations,
        to: change.after?.declarations,
        attribution,
        selectors,
      }))
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      );
  assert.deepEqual(values(actual), values(expected));
  assertUniqueOccurrences(actual);
  assert.deepEqual(actual.retainedSelectors, {
    status: "matched",
    selectors: [".a", ".c"],
  });
  assert.equal(actual.ownedComponentIds.size, 0);
  for (const side of ["before", "after"] as const)
    assert.deepEqual(
      inlineMaterialReplacements(actual, side),
      referenceMaterials(expected, side),
    );
});

for (const middle of ["red", "blue"])
  test(`nested ${middle === "red" ? "agreeing" : "displaced"} survivors pin parent and child occurrence choices`, () => {
    const single = (color: string) => `.parent{.a{color:${color}}}`;
    const group = ".parent{.a{color:red}.b{color:black}}";
    const body = '<main class="parent"><button class="a"></button></main>';
    const input = inlineInput({
      before: html(
        `<style>${single("red")}${single(middle)}${group}</style>`,
        body,
      ),
      after: html(`<style>${group}${single("green")}</style>`, body),
    });
    const actual = resolved(attributeInlineRules(input));
    const expected = reference(input);
    assert.ok(expected.status === "resolved");
    const pairs = (value: typeof expected) =>
      value.rules.map(({ change }) => [
        change.kind,
        change.before?.ordinal,
        change.after?.ordinal,
      ]);
    assert.deepEqual(pairs(actual), [
      ["removed", 2, undefined],
      ["removed", 3, undefined],
      ["changed", 1, 4],
    ]);
    assert.deepEqual(pairs(expected), [
      ["removed", 4, undefined],
      ["removed", 5, undefined],
      ["changed", 3, 4],
    ]);
    assert.equal(actual.rules[2]!.change.before?.declarations, "color:red");
    assert.equal(
      expected.rules[2]!.change.before?.declarations,
      `color:${middle}`,
    );
    assert.ok(
      actual.rules.every(({ attribution }) => attribution.kind === "entry"),
    );
    assertUniqueOccurrences(actual);
    assert.equal(actual.ownedComponentIds.size, 0);
    assert.deepEqual(actual.retainedSelectors, expected.retainedSelectors);
    for (const side of ["before", "after"] as const)
      assert.deepEqual(
        inlineMaterialReplacements(actual, side),
        referenceMaterials(expected, side),
      );
  });
