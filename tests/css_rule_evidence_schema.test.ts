import assert from "node:assert/strict";
import test from "node:test";

import { parseReviewResult } from "../packages/viewer/dist/data.js";

import { cssSchemaFixture } from "./helpers/review_css_schema.js";

const rule = {
  ruleKey: "a".repeat(64),
  status: "matched",
  selectors: [".action"],
  changedComponentPaths: ["action"],
  pageSelectors: [],
};
const analysis = { status: "matched", selectors: [".action"], rules: [rule] };
function fixture(value: unknown = analysis) {
  const result = cssSchemaFixture();
  Object.assign(result.screens[0]!.views[0]!.reasons![0]!, {
    analysis: structuredClone(value),
  });
  return result;
}

test("rule evidence admits component-only rules and exact page summary unions", () => {
  const componentOnly = fixture();
  assert.deepEqual(parseReviewResult(componentOnly), componentOnly);
  const page = fixture({
    ...analysis,
    rules: [{ ...rule, pageSelectors: [".action"] }],
    pageEvidence: { selectors: [".action"] },
  });
  assert.deepEqual(parseReviewResult(page), page);
});

for (const [name, patch] of [
  ["missing rules", { status: "matched", selectors: [".action"] }],
  ["empty rules", { ...analysis, rules: [] }],
  [
    "invalid key",
    { ...analysis, rules: [{ ...rule, ruleKey: "A".repeat(64) }] },
  ],
  ["duplicate rules", { ...analysis, rules: [rule, rule] }],
  ["selector summary mismatch", { ...analysis, selectors: [".else"] }],
  [
    "page subset mismatch",
    { ...analysis, rules: [{ ...rule, pageSelectors: [".else"] }] },
  ],
  [
    "missing page summary",
    { ...analysis, rules: [{ ...rule, pageSelectors: [".action"] }] },
  ],
  [
    "invented page summary",
    { ...analysis, pageEvidence: { selectors: [".action"] } },
  ],
  [
    "duplicate changed paths",
    {
      ...analysis,
      rules: [{ ...rule, changedComponentPaths: ["action", "action"] }],
    },
  ],
  [
    "invalid changed path",
    { ...analysis, rules: [{ ...rule, changedComponentPaths: ["bad path"] }] },
  ],
  [
    "matched unkeyed rule",
    { ...analysis, rules: [{ ...rule, ruleKey: undefined }] },
  ],
])
  test(`rule evidence rejects ${name}`, () =>
    assert.throws(() => parseReviewResult(fixture(patch)), /review/));

test("parse failure evidence is unkeyed and unresolved with no invented components", () => {
  const unresolved = fixture({
    status: "unresolved",
    selectors: [],
    rules: [
      {
        status: "unresolved",
        selectors: [],
        changedComponentPaths: [],
        pageSelectors: [],
      },
    ],
    pageEvidence: { selectors: [], unresolved: true },
  });
  assert.deepEqual(parseReviewResult(unresolved), unresolved);
  const reason = unresolved.screens[0]!.views[0]!.reasons![0]!;
  Object.assign(reason.analysis!.rules[0]!, {
    changedComponentPaths: ["action"],
  });
  assert.throws(() => parseReviewResult(unresolved), /review/);
});

test("a stylesheet reason cannot omit analysis to bypass rule validation", () => {
  const result = fixture();
  delete result.screens[0]!.views[0]!.reasons![0]!.analysis;
  assert.throws(() => parseReviewResult(result), /analysis/);
});
