import assert from "node:assert/strict";
import test from "node:test";

import { diffCssRules } from "../src/review/css/diff.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

import { analyzeInline, html, resolved } from "./helpers/inline_styles.js";
import { analyze, documents, kept } from "./helpers/review_css.js";

test("a statement and empty block have different CSS rule addresses", () => {
  const result = diffCssRules(
    "@layer a;",
    "@layer a{}",
    new LightningCssRuleParser(),
  );
  assert.equal(result.status, "resolved");
  assert.ok(result.status === "resolved");
  assert.equal(result.changed.length, 0);
  assert.deepEqual(
    result.removed.map(({ block }) => block),
    [false],
  );
  assert.deepEqual(
    result.added.map(({ block }) => block),
    [true],
  );
});

test("linked layer statement to block is a retained unresolved change", () => {
  assert.deepEqual(
    analyze("@layer a;", "@layer a{}", documents()),
    kept("unresolved"),
  );
});

test("inline layer statement to block is a retained unresolved change", () => {
  const result = resolved(
    analyzeInline({
      before: html("<style>@layer a;</style>", "<main></main>"),
      after: html("<style>@layer a{}</style>", "<main></main>"),
      parser: new CssResourceAnalysis().parser,
    }).result,
  );
  assert.equal(result.rules.length, 2);
  assert.deepEqual(result.retainedSelectors, {
    status: "unresolved",
    selectors: [],
  });
  assert.deepEqual(
    result.rules.map(({ attribution }) => attribution),
    [{ kind: "unresolved" }, { kind: "unresolved" }],
  );
});
