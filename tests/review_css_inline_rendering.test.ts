import assert from "node:assert/strict";
import test from "node:test";

import { extractCssReferences } from "../src/html_references.js";
import {
  inlineMaterialReplacements,
  renderInlineRules,
  type InlineMaterialProjection,
} from "../src/review/css/inline_rendering.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";
import type { CssRule } from "../src/review/css/types.js";

import {
  analyzeInline,
  html,
  instance,
  markedRange,
  range,
  resolved,
  view,
} from "./helpers/inline_styles.js";

function parsed(source: string): readonly CssRule[] {
  const result = new LightningCssRuleParser().parse(source);
  assert.equal(result.status, "parsed");
  assert.ok(result.status === "parsed");
  return result.rules;
}

function apply(source: string, projection: InlineMaterialProjection): string {
  let material = source;
  for (const replacement of [...projection.replacements].sort(
    (a, b) => b.start - a.start,
  ))
    material =
      material.slice(0, replacement.start) +
      replacement.text +
      material.slice(replacement.end);
  return material + projection.appendix;
}

test("canonical inline rendering orders sheet-leading statements before rule identities", () => {
  const rules = parsed(
    [
      '@charset "UTF-8";',
      '@import url("theme.css");',
      '@namespace svg url("http://www.w3.org/2000/svg");',
      "@layer reset;",
      ".z{color:red}",
      ".a{color:blue}",
    ].join(""),
  );
  const rendered = renderInlineRules([...rules].reverse());
  assert.equal(
    rendered,
    '@charset "UTF-8";@import "theme.css";@namespace svg "http://www.w3.org/2000/svg";@layer reset;.a{color:blue}.z{color:red}',
  );
});

test("canonical inline rendering wraps conditions and nesting outermost first", () => {
  const rule: CssRule = {
    ordinal: 9,
    selectors: ["& .child"],
    conditions: [
      { kind: "media", prelude: "screen" },
      { kind: "supports", prelude: "(display: grid)" },
      { kind: "nesting-parent", prelude: ".parent" },
    ],
    declarations: "color:red",
    hasCustomProperties: false,
  };
  assert.equal(
    renderInlineRules([rule]),
    "@media screen{@supports (display: grid){.parent{& .child{color:red}}}}",
  );
});

test("statement and block at-rules, including keyframes, render faithfully", () => {
  const rules = parsed(
    [
      '@import url("theme.css");',
      "@layer tokens;",
      "@layer components{}",
      '@font-face{font-family:"A";src:url("font.woff2")}',
      "@keyframes fade{from{opacity:0}to{opacity:1}}",
    ].join(""),
  );
  const forms = rules.flatMap((rule) =>
    rule.atRule ? [[rule.atRule, rule.block] as const] : [],
  );
  assert.deepEqual(forms, [
    ["import", false],
    ["layer", false],
    ["layer", true],
    ["font-face", true],
    ["keyframes", true],
  ]);
  const rendered = renderInlineRules(rules);
  assert.match(rendered, /@import "theme\.css";/);
  assert.match(rendered, /@layer tokens;/);
  assert.match(rendered, /@layer components\{\}/);
  assert.match(
    rendered,
    /@font-face\{font-family:"A";src:url\("font\.woff2"\)\}/,
  );
  assert.match(rendered, /@keyframes fade\{from\{opacity:0\}to\{opacity:1\}\}/);
});

test("the appended canonical fragment preserves import and URL references", () => {
  const before = html("", '<main class="target"></main>');
  const after = html(
    '<style>@import url("theme.css");.target{background:url("icon.svg")}</style>',
    '<main class="target"></main>',
  );
  const result = analyzeInline({ before, after }).result;
  assert.equal(result.status, "resolved");
  const replacements = inlineMaterialReplacements(result, "after");
  assert.deepEqual(extractCssReferences(replacements.actual.appendix), [
    "theme.css",
    "icon.svg",
  ]);
});

test("an import in a later style element remains a leading valid statement", () => {
  const result = analyzeInline({
    before: html("", '<main class="target"></main>'),
    after: html(
      '<style>.target{color:red}</style><style>@import url("late.css");</style>',
      '<main class="target"></main>',
    ),
  }).result;
  assert.equal(result.status, "resolved");
  const appendix = inlineMaterialReplacements(result, "after").actual.appendix;
  assert.match(appendix, /^<style>@import "late\.css";/);
  assert.deepEqual(extractCssReferences(appendix), ["late.css"]);
});

test("material removes every source element and ignores count and attributes", () => {
  const before = html(
    '<style nonce="before">.a{color:red}.b{color:blue}</style>',
    "",
  );
  const after = html(
    '<style data-emotion="a">.b{color:blue}</style><style nonce="after">.a{color:red}</style>',
    "",
  );
  const result = analyzeInline({ before, after }).result;
  assert.equal(result.status, "resolved");
  const left = inlineMaterialReplacements(result, "before");
  const right = inlineMaterialReplacements(result, "after");
  assert.equal(left.actual.replacements.length, 1);
  assert.equal(right.actual.replacements.length, 2);
  assert.equal(apply(before, left.actual), apply(after, right.actual));
  assert.doesNotMatch(apply(after, right.actual), /nonce|data-emotion/);
  assert.equal((apply(after, right.actual).match(/<style>/g) ?? []).length, 1);
});

test("excluded additions append the same empty fragment to both sides", () => {
  const before = html("", "<main></main>");
  const after = html("<style>.missing{color:red}</style>", "<main></main>");
  const result = analyzeInline({ before, after }).result;
  assert.equal(result.status, "resolved");
  const left = inlineMaterialReplacements(result, "before").actual;
  const right = inlineMaterialReplacements(result, "after").actual;
  assert.equal(left.appendix, "<style></style>");
  assert.equal(apply(before, left), apply(after, right));
});

test("actual material retains owned rules while projected material removes them", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const body = markedRange(0, '<main class="target"></main>');
  const before = html("<style>.target{color:red}</style>", body);
  const after = html("<style>.target{color:blue}</style>", body);
  const result = analyzeInline({
    before,
    after,
    beforeUsage: usage,
    afterUsage: usage,
  }).result;
  assert.equal(result.status, "resolved");
  const left = inlineMaterialReplacements(result, "before");
  const right = inlineMaterialReplacements(result, "after");
  assert.notEqual(apply(before, left.actual), apply(after, right.actual));
  assert.equal(apply(before, left.projected), apply(after, right.projected));
  assert.equal(left.projected.appendix, "<style></style>");
});

test("parse failures and identical outer sources retain verbatim elements", () => {
  const before = html("<style>.a{color:red}</style>", "");
  const failedAfter = html("<style>.a{color:blue</style>", "");
  const unresolved = analyzeInline({ before, after: failedAfter }).result;
  assert.equal(unresolved.status, "unresolved");
  const failedMaterial = inlineMaterialReplacements(unresolved, "after");
  assert.deepEqual(failedMaterial.actual, { replacements: [], appendix: "" });
  assert.equal(apply(failedAfter, failedMaterial.actual), failedAfter);

  const identical = html("<style>.same{color:red}</style>", "");
  const skipped = analyzeInline({
    before: identical,
    after: identical,
    parser: {
      parse: () => {
        throw new Error("identical outer sources must not parse");
      },
    },
  }).result;
  assert.equal(skipped.status, "skipped");
  const skippedMaterial = inlineMaterialReplacements(skipped, "before");
  assert.equal(apply(identical, skippedMaterial.actual), identical);
});

test("unchanged reference rules omit owned and excluded material symmetrically", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const body = markedRange(0, '<main class="target"></main>');
  const ownedDocument = html(
    '<style>.target{background:url("owned.svg")}</style>',
    body,
  );
  const owned = resolved(
    analyzeInline({
      before: ownedDocument,
      after: ownedDocument,
      beforeUsage: usage,
      afterUsage: usage,
    }).result,
  );
  assert.equal(owned.rules.length, 1);
  assert.equal(owned.rules[0]?.change.kind, "unchanged");
  assert.deepEqual(owned.rules[0]?.attribution, {
    kind: "owned",
    componentIds: ["component"],
  });
  assert.deepEqual([...owned.ownedComponentIds], []);
  assert.equal(owned.retainedSelectors, undefined);
  const ownedBefore = inlineMaterialReplacements(owned, "before");
  const ownedAfter = inlineMaterialReplacements(owned, "after");
  assert.equal(ownedBefore.projected.appendix, "<style></style>");
  assert.equal(
    apply(ownedDocument, ownedBefore.projected),
    apply(ownedDocument, ownedAfter.projected),
  );
  assert.deepEqual(extractCssReferences(ownedBefore.actual.appendix), [
    "owned.svg",
  ]);

  const excludedDocument = html(
    '<style>.missing{background:url("excluded.svg")}</style>',
    "<main></main>",
  );
  const excluded = resolved(
    analyzeInline({ before: excludedDocument, after: excludedDocument }).result,
  );
  assert.equal(excluded.rules[0]?.change.kind, "unchanged");
  assert.deepEqual(excluded.rules[0]?.attribution, { kind: "excluded" });
  for (const side of ["before", "after"] as const) {
    const replacements = inlineMaterialReplacements(excluded, side);
    assert.equal(replacements.actual.appendix, "<style></style>");
    assert.equal(replacements.projected.appendix, "<style></style>");
  }
});
