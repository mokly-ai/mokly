import assert from "node:assert/strict";
import test from "node:test";

import { attributeInlineRules } from "../src/review/css/inline_attribution.js";
import { inlineMaterialReplacements } from "../src/review/css/inline_rendering.js";
import { cssRuleData } from "../src/review/css/rule_identity.js";

import {
  html,
  inlineInput,
  instance,
  markedRange,
  range,
  resolved,
  view,
} from "./helpers/inline_styles.js";

test("composition sorts once per side and projected order filters actual order", (context) => {
  const component = instance(1, "action");
  const usage = view({
    instances: [component],
    ranges: [range(0, { kind: "instance", instanceKey: component.key })],
  });
  const body = `<main class="entry"></main>${markedRange(0, '<button class="owned"></button>')}`;
  const result = resolved(
    attributeInlineRules(
      inlineInput({
        before: html(
          "<style>.z{color:black}.owned{color:red}@layer z;.entry{color:red}@layer a;</style>",
          body,
        ),
        after: html(
          "<style>.entry{color:blue}@layer a;.owned{color:blue}@layer z;.z{color:black}</style>",
          body,
        ),
        beforeUsage: usage,
        afterUsage: usage,
      }),
    ),
  );
  let sorts = 0;
  const original = Array.prototype.sort;
  context.after(() => {
    Array.prototype.sort = original;
  });
  Array.prototype.sort = context.mock.fn(function (
    this: unknown[],
    compare?: (left: unknown, right: unknown) => number,
  ) {
    if (
      this.some(
        (value) => value && typeof value === "object" && "ordinal" in value,
      )
    )
      sorts++;
    return original.call(this, compare);
  });
  for (const side of ["before", "after"] as const) {
    const materials = inlineMaterialReplacements(result, side);
    const runs = side === "before" ? result.beforeRuns : result.afterRuns;
    const owned = new Set(
      result.rules.flatMap(({ change, attribution }) =>
        attribution.kind === "owned" && change[side]
          ? [cssRuleData(change[side]!).canonicalText]
          : [],
      ),
    );
    const canonicalTexts = runs.flatMap(({ run }) =>
      run.rules.map((rule) => cssRuleData(rule).canonicalText),
    );
    const actualOrder = canonicalTexts
      .filter((text) => materials.actual.appendix.includes(text))
      .sort(
        (left, right) =>
          materials.actual.appendix.indexOf(left) -
          materials.actual.appendix.indexOf(right),
      );
    assert.equal(
      materials.projected.appendix,
      `<style>${actualOrder.filter((text) => !owned.has(text)).join("")}</style>`,
    );
  }
  assert.equal(sorts, 2);
});
