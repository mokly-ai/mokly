import assert from "node:assert/strict";
import test from "node:test";

import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { cssSchemaFixture } from "./helpers/review_css_schema.js";

const stylesheet = "static/shared.css";
const entryOwner = { kind: "entry" };
const record = (
  selector: string,
  status = "matched",
  owner: unknown = entryOwner,
  sheet = stylesheet,
) => ({ stylesheet: sheet, selector, status, owner });

/** The fixture with its mobile view's rules replaced, as untyped wire data. */
function withRules(
  rules: unknown,
  edit?: (result: ReviewResult) => void,
): ReviewResult {
  const result = cssSchemaFixture();
  Object.assign(result.entries[0]!.views[0]!, {
    rules: structuredClone(rules),
  });
  edit?.(result);
  return result;
}

test("rule evidence admits page-owned, component-owned, and unresolved records", () => {
  const fixture = cssSchemaFixture();
  assert.deepEqual(parseReviewResult(structuredClone(fixture)), fixture);
  const mixed = withRules([
    record("", "unresolved"),
    record(".auth", "matched", { kind: "component", path: "button" }),
    record(".auth"),
  ]);
  assert.deepEqual(parseReviewResult(structuredClone(mixed)), mixed);
});

for (const [name, rules] of [
  ["an empty rule list", []],
  ["a null rule list", null],
  [
    "a private source path",
    [record(".auth", "matched", entryOwner, "mockups/shared.css")],
  ],
  [
    "a dot segment",
    [record(".auth", "matched", entryOwner, "static/../shared.css")],
  ],
  [
    "a query",
    [record(".auth", "matched", entryOwner, "static/shared.css?v=1")],
  ],
  ["an unknown status", [record(".auth", "kept")]],
  ["an unknown owner", [record(".auth", "matched", { kind: "page" })]],
  [
    "an owner without its path",
    [record(".auth", "matched", { kind: "component" })],
  ],
  [
    "an entry owner with a path",
    [record(".auth", "matched", { kind: "entry", path: "auth" })],
  ],
  ["an extra field", [{ ...record(".auth"), ruleKey: "a".repeat(64) }]],
  ["duplicate records", [record(".auth"), record(".auth")]],
  ["unsorted records", [record(".button"), record(".auth")]],
  ["an excluded record with a selector", [record(".auth", "excluded")]],
  [
    "an excluded record owned by a component",
    [record("", "excluded", { kind: "component", path: "button" })],
  ],
  [
    "an excluded record beside a kept one",
    [record("", "excluded"), record(".auth")],
  ],
  [
    "an unresolved record owned by a component",
    [record("", "unresolved", { kind: "component", path: "button" })],
  ],
] as const)
  test(`rule evidence rejects ${name}`, () =>
    assert.throws(() => parseReviewResult(withRules(rules)), /review/));

test("an unchanged view keeps no page-owned kept record", () => {
  const result = withRules([record(".auth")], (value) => {
    value.entries[0]!.views[1]!.rules = [record(".auth")] as never;
  });
  assert.throws(() => parseReviewResult(result), /review/);
  const owned = withRules([record(".auth")], (value) => {
    value.entries[0]!.views[1]!.rules = [
      record(".auth", "matched", { kind: "component", path: "button" }),
    ] as never;
  });
  assert.deepEqual(parseReviewResult(structuredClone(owned)), owned);
});

test("a stylesheet reason needs a kept record the entry owns", () => {
  const consumerOnly = withRules([
    record(".auth", "matched", { kind: "component", path: "button" }),
  ]);
  assert.throws(() => parseReviewResult(consumerOnly), /review/);
  const excludedOnly = withRules([record("", "excluded")]);
  assert.throws(() => parseReviewResult(excludedOnly), /review/);
});
