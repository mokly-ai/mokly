import assert from "node:assert/strict";

import { diffCssRuleLists } from "../../src/review/css/diff.js";
import {
  attributeInlineRules,
  type InlineAttributionInput,
  type InlineAttributionResult,
} from "../../src/review/css/inline_attribution.js";
import {
  applyInlineMaterial,
  inlineMaterialReplacements,
} from "../../src/review/css/inline_rendering.js";
import { parseInlineRuns } from "../../src/review/css/inline_rule_runs.js";
import { inlineSegmentChanges } from "../../src/review/css/inline_segment_changes.js";

import { parseSnapshot } from "./css_segments.js";
import {
  attributeInlineRules as reference,
  type InlineAttributionResult as ReferenceResult,
} from "./inline_m4_attribution.js";
import { inlineMaterialReplacements as referenceMaterials } from "./inline_m4_rendering.js";

export function analysisSnapshot(
  result: InlineAttributionResult | ReferenceResult,
): unknown {
  if (result.status === "unresolved")
    return {
      ...result,
      failures: result.failures.map(({ side, error }) => ({
        side,
        parse: parseSnapshot({ status: "unresolved", error }),
      })),
    };
  if (result.status !== "resolved") return result;
  const {
    beforeRules,
    afterRules,
    rules,
    ownedComponentIds,
    retainedSelectors,
    beforeSpans,
    afterSpans,
  } = result;
  return {
    status: result.status,
    beforeRules,
    afterRules,
    rules,
    ownedComponentIds,
    retainedSelectors,
    beforeSpans,
    afterSpans,
    allExcluded: rules
      .filter(({ change }) => change.kind !== "unchanged")
      .every(({ attribution }) => attribution.kind === "excluded"),
  };
}

export function compareInlineOracle(
  input: InlineAttributionInput,
  label = "",
): InlineAttributionResult {
  const actual = attributeInlineRules(input);
  const expected = reference(input);
  assert.deepEqual(analysisSnapshot(actual), analysisSnapshot(expected), label);
  for (const side of ["before", "after"] as const) {
    const left = inlineMaterialReplacements(actual, side);
    const right = referenceMaterials(expected, side);
    assert.deepEqual(left, right, `${label}: ${side} materials`);
    for (const kind of ["actual", "projected"] as const)
      assert.equal(
        applyInlineMaterial(input[side].source, left[kind]),
        applyInlineMaterial(input[side].source, right[kind]),
        label,
      );
  }
  if (actual.status === "resolved") {
    const base = parseInlineRuns(actual.beforeSpans, input.parser);
    const head = parseInlineRuns(actual.afterSpans, input.parser);
    assert.ok(base.status === "parsed" && head.status === "parsed");
    assert.deepEqual(
      inlineSegmentChanges(base, head).diff,
      diffCssRuleLists(actual.beforeRules, actual.afterRules),
      `${label}: ordered diff`,
    );
    assertUniqueOccurrences(actual);
  }
  return actual;
}

export function assertUniqueOccurrences(
  result: Extract<InlineAttributionResult, { status: "resolved" }>,
) {
  for (const side of ["before", "after"] as const) {
    const rules = result.rules.flatMap(({ change }) =>
      change[side] ? [change[side]!] : [],
    );
    assert.equal(
      new Set(rules.map(({ ordinal }) => ordinal)).size,
      rules.length,
      `${side}: repeated occurrence`,
    );
    assert.equal(
      new Set(rules).size,
      rules.length,
      `${side}: repeated rule object`,
    );
  }
}
