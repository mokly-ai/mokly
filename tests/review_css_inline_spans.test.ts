import assert from "node:assert/strict";
import test from "node:test";

import { generatedHeader } from "../src/build/ownership.js";
import { findUnownedInlineStyles } from "../src/review/css/inline_styles.js";
import { normalizeReviewPair } from "../src/review/ignore.js";

import {
  analyzeInline,
  changedStyle,
  html,
  instance,
  key,
  markedRange,
  range,
  resolved,
  view,
} from "./helpers/inline_styles.js";

test("span discovery accepts only document-tree HTML CSS style elements", () => {
  const source = html(
    [
      "<style>.one{}</style>",
      '<style type="">.two{}</style>',
      '<style type="TEXT/CSS">.three{}</style>',
      '<style type="text/cſs">.unicode-fold{}</style>',
      '<style media="print">.media{}</style>',
      '<style type="text/less">.less{}</style>',
      "<svg><style>.svg{}</style></svg>",
      "<math><style>.math{}</style></math>",
      "<template><style>.template{}</style></template>",
    ].join(""),
    "",
  );
  const spans = findUnownedInlineStyles(source, [], new Set());
  assert.deepEqual(
    spans.map(({ text }) => text),
    [".one{}", ".two{}", ".three{}"],
  );
  assert.ok(
    spans.every(
      (span) =>
        source.slice(span.start, span.end) === span.source &&
        span.source.startsWith("<style") &&
        span.source.endsWith("</style>"),
    ),
  );
});

test("style elements inside component ranges are not unowned material", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const result = analyzeInline({
    before: html("", markedRange(0, "<style>.a{color:red}</style>")),
    after: html("", markedRange(0, "<style>.a{color:blue}</style>")),
    beforeUsage: usage,
    afterUsage: usage,
  }).result;
  assert.equal(result.status, "skipped");
  assert.equal(result.beforeSpans.length, 0);
  assert.equal(result.afterSpans.length, 0);
});

test("baseline-v7 markers and a generated header keep original span coordinates", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const header = generatedHeader("entries/fixture.mockup.tsx");
  const styles = changedStyle();
  const historicalIgnored =
    "<!--mokly-review-ignore:start:legacy--><style>.ignored{color:red}</style><!--mokly-review-ignore:end:legacy-->";
  const currentIgnored =
    "<!--mokly-review-ignore:start:legacy--><style>.ignored{color:blue}</style><!--mokly-review-ignore:end:legacy-->";
  const before = `${header}${html(
    styles.before,
    `${markedRange(0, '<div class="target"></div>')}${historicalIgnored}`,
  )}`;
  const after = `${header}${html(
    styles.after,
    `${markedRange(0, '<div class="target"></div>')}${currentIgnored}`,
  )}`;
  const result = resolved(
    analyzeInline({ before, after, beforeUsage: usage, afterUsage: usage })
      .result,
  );
  assert.ok(result.beforeSpans[0]!.start > header.length);
  assert.equal(result.beforeSpans.length, 1);
  assert.equal(result.afterSpans.length, 1);
  assert.deepEqual(result.rules[0]?.attribution, {
    kind: "owned",
    componentIds: ["component"],
  });
});

test("outer attributes and element splits run analysis by rule multiset", () => {
  const attributes = resolved(
    analyzeInline({
      before: html('<style nonce="before">.a{color:red}</style>', ""),
      after: html('<style nonce="after">.a{color:red}</style>', ""),
    }).result,
  );
  assert.equal(attributes.rules.length, 0);
  assert.notEqual(
    attributes.beforeSpans[0]?.source,
    attributes.afterSpans[0]?.source,
  );

  const split = resolved(
    analyzeInline({
      before: html("<style>.a{color:red}.b{color:blue}</style>", ""),
      after: html(
        "<style>.a{color:red}</style><style>.b{color:blue}</style>",
        "",
      ),
    }).result,
  );
  assert.equal(split.rules.length, 0);
  assert.deepEqual(
    split.beforeRules.map(({ ordinal }) => ordinal),
    [0, 1],
  );
  assert.deepEqual(
    split.afterRules.map(({ ordinal }) => ordinal),
    [0, 1],
  );
});

test("paired ignored styles stay in place while one-sided regions are analyzed", () => {
  const ignored = (content: string) =>
    `<!--mokly-review-ignore:start:styles-->${content}<!--mokly-review-ignore:end:styles-->`;
  const beforeStyle = "<style>.missing{color:red}</style>";
  const afterStyle = "<style>.missing{color:blue}</style>";
  const paired = analyzeInline({
    before: html("", ignored(beforeStyle)),
    after: html("", ignored(afterStyle)),
  }).result;
  assert.equal(paired.status, "skipped");
  assert.equal(paired.beforeSpans.length, 0);
  assert.equal(paired.afterSpans.length, 0);

  const oneSided = resolved(
    analyzeInline({
      before: html("", ignored(beforeStyle)),
      after: html("", afterStyle),
    }).result,
  );
  assert.equal(oneSided.beforeSpans.length, 1);
  assert.equal(oneSided.afterSpans.length, 1);
  assert.deepEqual(oneSided.rules[0]?.attribution, { kind: "excluded" });
});

test("retired ignore markers do not create or replace a paired current region", () => {
  const source = html(
    "<!--mokly-review-ignore:start:styles--><style>.current{}</style><!--mokly-review-ignore:end:styles-->" +
      "<!--mokabook-review-ignore:start:styles--><style>.retired{}</style><!--mokabook-review-ignore:end:styles-->",
    "",
  );
  const pair = normalizeReviewPair(source, source, "test.html");
  assert.deepEqual(pair.pairedIgnoreIds, ["styles"]);
  const spans = findUnownedInlineStyles(
    source,
    [],
    new Set(pair.pairedIgnoreIds),
  );
  assert.deepEqual(
    spans.map(({ text }) => text),
    [".retired{}"],
  );
});

test("one-sided material evidence removes an otherwise paired ignore id", () => {
  const region =
    "<!--mokly-review-ignore:start:styles--><style>.a{}</style><!--mokly-review-ignore:end:styles-->";
  const material = `<!--mokly-review-material:styles:${key(99)}-->`;
  const pair = normalizeReviewPair(region, `${region}${material}`, "test.html");
  assert.deepEqual(pair.pairedIgnoreIds, []);
});
