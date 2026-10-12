import assert from "node:assert/strict";
import test from "node:test";

import { renderReviewArtifact } from "../dist/review/artifact.js";
import { parseReviewResult } from "../packages/viewer/dist/review/result_validation.js";
import type { ReviewResult } from "../packages/viewer/dist/review/types.js";

import { fixtureCssAnalysis } from "./helpers/css_evidence.js";
import {
  cssSchemaFiles,
  cssSchemaFixture,
} from "./helpers/review_css_schema.js";

function fixture(_version: 7): ReviewResult {
  return structuredClone(cssSchemaFixture());
}

test("schema-v7 artifact validation triggers for inline evidence alone", () => {
  const result = fixture(7);
  for (const view of result.screens[0]!.views) {
    delete view.material;
    delete view.reasons;
    delete view.excludedResources;
  }
  Object.assign(firstView(result), {
    state: "unchanged",
    inlineStyles: { status: "matched", selectors: [".a"] },
  });
  assert.throws(
    () => renderReviewArtifact({ result, files: cssSchemaFiles() }),
    /retained inline styles/,
  );
});

function firstView(result: ReviewResult) {
  return result.screens[0]!.views[0]!;
}

function secondView(result: ReviewResult) {
  return result.screens[0]!.views[1]!;
}

for (const version of [7] as const) {
  for (const evidence of [
    { status: "matched", selectors: [".a", ".z"] },
    { status: "unresolved", selectors: [] },
    { status: "unresolved", selectors: [":root"] },
  ] as const)
    test(`v${version} accepts retained inline evidence ${evidence.status}/${evidence.selectors.length}`, () => {
      const result = fixture(version);
      Object.assign(firstView(result), { inlineStyles: evidence });
      assert.deepEqual(parseReviewResult(result), result);
    });

  test(`v${version} accepts excluded inline evidence`, () => {
    const result = fixture(version);
    Object.assign(secondView(result), {
      inlineStyles: { status: "excluded" },
    });
    assert.deepEqual(parseReviewResult(result), result);
  });

  for (const [name, evidence] of [
    ["unknown status", { status: "other" }],
    ["unknown field", { status: "excluded", extra: true }],
    ["excluded selectors", { status: "excluded", selectors: [] }],
    ["missing matched selectors", { status: "matched" }],
    ["missing unresolved selectors", { status: "unresolved" }],
    ["empty matched selectors", { status: "matched", selectors: [] }],
    ["unsorted selectors", { status: "matched", selectors: [".z", ".a"] }],
    ["duplicate selectors", { status: "matched", selectors: [".a", ".a"] }],
    ["invalid selector", { status: "matched", selectors: [""] }],
  ] as const)
    test(`v${version} rejects ${name}`, () => {
      const result = fixture(version);
      Object.assign(firstView(result), { inlineStyles: evidence });
      assert.throws(() => parseReviewResult(result), /mokly\/review/);
    });

  test(`v${version} rejects retained evidence without changed material`, () => {
    const result = fixture(version);
    const view = firstView(result);
    Object.assign(view, {
      state: "unchanged",
      inlineStyles: { status: "matched", selectors: [".a"] },
    });
    delete view.material;
    assert.throws(() => parseReviewResult(result), /retained inline styles/);
  });

  test(`v${version} rejects retained evidence without material`, () => {
    const result = fixture(version);
    const view = firstView(result);
    Object.assign(view, {
      inlineStyles: { status: "unresolved", selectors: [] },
    });
    delete view.material;
    assert.throws(() => parseReviewResult(result), /retained inline styles/);
  });

  test(`v${version} rejects retained evidence on a one-sided view`, () => {
    const result = fixture(version);
    const view = firstView(result);
    Object.assign(view, {
      inlineStyles: { status: "matched", selectors: [".a"] },
    });
    view.state = "added";
    assert.throws(() => parseReviewResult(result), /paired view/);
  });

  for (const state of ["changed", "ignored-only"] as const)
    test(`v${version} rejects excluded evidence on a ${state} view`, () => {
      const result = fixture(version);
      const view = secondView(result);
      Object.assign(view, { state, inlineStyles: { status: "excluded" } });
      assert.throws(() => parseReviewResult(result), /excluded inline styles/);
    });

  test(`v${version} rejects excluded evidence with material`, () => {
    const result = fixture(version);
    const view = secondView(result);
    Object.assign(view, {
      state: "changed",
      material: true,
      inlineStyles: { status: "excluded" },
    });
    assert.throws(() => parseReviewResult(result), /excluded inline styles/);
  });

  test(`v${version} rejects excluded evidence beside reasons`, () => {
    const result = fixture(version);
    const view = secondView(result);
    delete view.excludedResources;
    Object.assign(view, {
      reasons: [
        {
          kind: "dependency",
          path: "mockups/shared.css",
          analysis: fixtureCssAnalysis("matched", [".auth"]),
        },
      ],
      inlineStyles: { status: "excluded" },
    });
    assert.throws(() => parseReviewResult(result), /excluded inline styles/);
  });

  test(`v${version} rejects excluded evidence on a one-sided view`, () => {
    const result = fixture(version);
    const view = secondView(result);
    Object.assign(view, { inlineStyles: { status: "excluded" } });
    view.state = "added";
    assert.throws(() => parseReviewResult(result), /paired view/);
  });
}
