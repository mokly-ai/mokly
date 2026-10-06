import assert from "node:assert/strict";
import test from "node:test";

import { parse as parseSelector } from "css-what";
import { parse } from "parse5";

import { matchesDocument } from "../packages/mokly/dist/review/css/document_query.js";
import { matchCssRules } from "../packages/mokly/dist/review/css/match.js";
import { CssSelectorError } from "../packages/mokly/dist/review/css/match_types.js";
import { CssResourceAnalysis } from "../packages/mokly/dist/review/css/resource_analysis.js";

test("a throwing matcher keeps its resource unresolved and continues classification", () => {
  const analysis = new CssResourceAnalysis(undefined, (diff, documents) => {
    if (
      diff.status === "resolved" &&
      diff.added.some((rule) =>
        rule.selectors.some((selector) => selector === ".failure"),
      )
    )
      throw new Error("Injected matcher failure");
    return matchCssRules(diff, documents);
  });
  assert.deepEqual(
    analysis.analyze(
      [
        { path: "a.css", after: ".failure { color: red; }" },
        { path: "b.css", after: ".auth { color: blue; }" },
        { path: "c.css", after: ".unused { color: green; }" },
      ],
      [{ after: parse('<!doctype html><p class="auth">Sign in</p>') }],
    ),
    {
      reasons: [
        {
          kind: "dependency",
          path: "a.css",
          analysis: { status: "unresolved", selectors: [".failure"] },
        },
        {
          kind: "dependency",
          path: "b.css",
          analysis: { status: "matched", selectors: [".auth"] },
        },
      ],
      excludedResources: [{ path: "c.css", reason: "no-matching-rule" }],
    },
  );
});

test("selector traversal errors use the same contained boundary as compilation errors", () => {
  const document = parse("<!doctype html><p>Sign in</p>");
  Object.defineProperty(document, "childNodes", {
    get() {
      throw new Error("Injected tree traversal failure");
    },
  });
  assert.throws(
    () => matchesDocument(parseSelector(".auth"), document),
    CssSelectorError,
  );
});
