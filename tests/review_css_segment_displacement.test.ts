import assert from "node:assert/strict";
import test from "node:test";

import { attributeInlineRules } from "../src/review/css/inline_attribution.js";
import { inlineMaterialReplacements } from "../src/review/css/inline_rendering.js";

import { assertUniqueOccurrences } from "./helpers/inline_analysis_oracle.js";
import { attributeInlineRules as reference } from "./helpers/inline_m4_attribution.js";
import { inlineMaterialReplacements as oldMaterials } from "./helpers/inline_m4_rendering.js";
import {
  html,
  inlineInput,
  instance,
  markedRange,
  range,
  resolved,
  view,
} from "./helpers/inline_styles.js";

for (const kind of ["plain", "custom", "url", "agree"] as const)
  test(`grouped ${kind} displacement pins the M4 and segment-selected copies and final material`, () => {
    const declaration = (color: string) =>
      kind === "custom"
        ? `--tone:${color};color:${color}`
        : kind === "url"
          ? `background:url("${color}.svg")`
          : `color:${color}`;
    const single = (color: string) =>
      `@media screen{.a{${declaration(color)}}}`;
    const group = `@media screen{.a{${declaration("red")}}.b{color:black}}`;
    const item = instance(1, "action");
    const usage = view({
      instances: [item],
      ranges: [range(0, { kind: "instance", instanceKey: item.key })],
    });
    const body = markedRange(0, '<button class="a"></button>');
    const input = inlineInput({
      before: html(
        `<style>${single("red")}${single(kind === "agree" ? "red" : "blue")}${group}</style>`,
        body,
      ),
      after: html(`<style>${group}${single("green")}</style>`, body),
      beforeUsage: usage,
      afterUsage: usage,
    });
    const actual = resolved(attributeInlineRules(input));
    const expected = reference(input);
    assert.ok(expected.status === "resolved");
    const pairOrdinals = (value: Pick<typeof expected, "rules">) =>
      value.rules.map(({ change }) => [
        change.kind,
        change.before?.ordinal,
        change.after?.ordinal,
      ]);
    assert.deepEqual(pairOrdinals(actual), [
      ["removed", 1, undefined],
      ["changed", 0, 2],
      ...(kind === "url" ? [["unchanged", 2, 0]] : []),
    ]);
    assert.deepEqual(pairOrdinals(expected), [
      ["removed", 2, undefined],
      ["changed", 1, 2],
      ...(kind === "url" ? [["unchanged", 0, 0]] : []),
    ]);
    assert.equal(
      actual.rules[1]!.change.before?.declarations,
      declaration("red"),
    );
    assert.equal(
      expected.rules[1]!.change.before?.declarations,
      declaration(kind === "agree" ? "red" : "blue"),
    );
    assertUniqueOccurrences(actual);
    assert.deepEqual(
      actual.rules.map(({ attribution }) => attribution.kind),
      kind === "custom"
        ? ["unresolved", "unresolved"]
        : kind === "url"
          ? ["owned", "owned", "owned"]
          : ["owned", "owned"],
    );
    assert.deepEqual(
      [...actual.ownedComponentIds],
      kind === "custom" ? [] : ["action"],
    );
    assert.deepEqual(
      actual.retainedSelectors,
      kind === "custom"
        ? { status: "unresolved", selectors: [".a"] }
        : undefined,
    );
    assert.ok(
      actual.rules
        .filter(({ change }) => change.kind !== "unchanged")
        .every(({ attribution }) => attribution.kind !== "excluded"),
    );
    for (const side of ["before", "after"] as const) {
      const materials = inlineMaterialReplacements(actual, side);
      assert.deepEqual(materials, oldMaterials(expected, side));
      if (kind === "url")
        assert.equal(
          materials.projected.appendix,
          "<style>@media screen{.b{color:black}}</style>",
        );
      else if (kind === "custom")
        assert.equal(materials.actual.appendix, materials.projected.appendix);
      else
        assert.equal(
          materials.projected.appendix,
          "<style>@media screen{.a{color:red}}@media screen{.b{color:black}}</style>",
        );
    }
    if (kind === "agree") {
      const values = (value: Pick<typeof expected, "rules">) =>
        value.rules.map(({ change, attribution, selectors }) => ({
          kind: change.kind,
          from: change.before?.declarations,
          to: change.after?.declarations,
          attribution,
          selectors,
        }));
      assert.deepEqual(values(actual), values(expected));
    }
  });

test("displaced changed pairs can change the custom-property keep judgment, exactly as approved", () => {
  const group = "@media screen{.a{--tone:red;color:red}.b{color:black}}";
  const item = instance(1, "action");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const body = markedRange(0, '<button class="a"></button>');
  const input = inlineInput({
    before: html(
      `<style>@media screen{.a{--tone:red;color:red}}@media screen{.a{--tone:blue;color:blue}}${group}</style>`,
      body,
    ),
    after: html(
      `<style>${group}@media screen{.a{--tone:blue;color:green}}</style>`,
      body,
    ),
    beforeUsage: usage,
    afterUsage: usage,
  });
  const actual = resolved(attributeInlineRules(input));
  const expected = reference(input);
  assert.ok(expected.status === "resolved");
  assertUniqueOccurrences(actual);
  assert.deepEqual(
    actual.rules.map(({ attribution }) => attribution.kind),
    ["unresolved", "unresolved"],
  );
  assert.deepEqual(
    expected.rules.map(({ attribution }) => attribution.kind),
    ["unresolved", "owned"],
  );
  assert.deepEqual([...actual.ownedComponentIds], []);
  assert.deepEqual([...expected.ownedComponentIds], ["action"]);
  for (const side of ["before", "after"] as const) {
    const material = inlineMaterialReplacements(actual, side);
    assert.equal(
      material.actual.appendix,
      oldMaterials(expected, side).actual.appendix,
    );
    assert.equal(material.actual.appendix, material.projected.appendix);
    assert.notEqual(
      material.projected.appendix,
      oldMaterials(expected, side).projected.appendix,
    );
  }
});
