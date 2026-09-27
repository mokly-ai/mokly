import assert from "node:assert/strict";
import test from "node:test";

import type { CssRule, CssRuleParser } from "../src/review/css/types.js";

import {
  analyzeInline,
  changedStyle,
  html,
  instance,
  markedRange,
  oneAttribution,
  range,
  resolved,
  view,
} from "./helpers/inline_styles.js";

test("rules matching neither document are excluded", () => {
  const styles = changedStyle(".missing");
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, "<main></main>"),
        after: html(styles.after, "<main></main>"),
      }).result,
    ),
    { kind: "excluded" },
  );
});

test("retained selectors report matched or unresolved entry material", () => {
  const matched = resolved(
    analyzeInline({
      before: html("<style>.target{color:red}</style>", '<p class="target"/>'),
      after: html("<style>.target{color:blue}</style>", '<p class="target"/>'),
    }).result,
  );
  assert.deepEqual(matched.retainedSelectors, {
    status: "matched",
    selectors: [".target"],
  });

  const unresolved = resolved(
    analyzeInline({
      before: html("<style>:root{color:red}</style>", ""),
      after: html("<style>:root{color:blue}</style>", ""),
    }).result,
  );
  assert.deepEqual(unresolved.retainedSelectors, {
    status: "unresolved",
    selectors: [":root"],
  });
});

function parserRule(rule: CssRule): CssRuleParser {
  return {
    parse: (source) => ({
      status: "parsed",
      rules: source ? [rule] : [],
    }),
  };
}

for (const [name, after, parser] of [
  [
    "selector parse failure",
    "fixture",
    parserRule({
      ordinal: 0,
      selectors: ["["],
      conditions: [],
      declarations: "color:red",
      hasCustomProperties: false,
    }),
  ],
  ["shadow selector", ".missing::part(label){color:red}"],
  ["global selector", ":root{color:red}"],
  [
    "unresolvable nesting parent",
    "fixture",
    parserRule({
      ordinal: 0,
      selectors: [".missing"],
      conditions: [{ kind: "nesting-parent", prelude: "&" }],
      declarations: "color:red",
      hasCustomProperties: false,
    }),
  ],
  ["custom property", ".missing{--tone:red}"],
  ["selector-less at-rule", '@font-face{font-family:"A"}'],
] as const) {
  test(`inline attribution shares the keep rule for ${name}`, () => {
    const result = analyzeInline({
      before: html("", "<main></main>"),
      after: html(`<style>${after}</style>`, "<main></main>"),
      ...(parser ? { parser } : {}),
    }).result;
    assert.deepEqual(oneAttribution(result), { kind: "unresolved" });
  });
}

test("changed inline references use matching instead of the stylesheet keep rule", () => {
  const excluded = analyzeInline({
    before: html("", "<main></main>"),
    after: html(
      '<style>.missing{background:url("icon.svg")}</style>',
      "<main></main>",
    ),
  }).result;
  assert.deepEqual(oneAttribution(excluded), { kind: "excluded" });

  const retained = analyzeInline({
    before: html("", '<main class="target"></main>'),
    after: html(
      '<style>.target{background:url("icon.svg")}</style>',
      '<main class="target"></main>',
    ),
  }).result;
  assert.deepEqual(oneAttribution(retained), { kind: "entry" });
});

test("an unchanged string-form import remains unresolved without evidence selectors", () => {
  const document = html('<style>@import "theme.css";</style>', "<main></main>");
  const result = resolved(
    analyzeInline({ before: document, after: document }).result,
  );
  assert.equal(result.rules[0]?.change.kind, "unchanged");
  assert.deepEqual(result.rules[0]?.attribution, { kind: "unresolved" });
  assert.equal(result.retainedSelectors, undefined);
});

test("one failed style element makes the whole side unresolved", () => {
  const result = analyzeInline({
    before: html("<style>.target{color:red}</style>", '<p class="target"/>'),
    after: html(
      "<style>.target{color:blue</style><style>.other{color:red}</style>",
      '<p class="target"/>',
    ),
  }).result;
  assert.equal(result.status, "unresolved");
  assert.ok(result.status === "unresolved");
  assert.deepEqual(
    result.failures.map(({ side }) => side),
    ["after"],
  );
  assert.deepEqual(result.retainedSelectors, {
    status: "unresolved",
    selectors: [],
  });
});

test("paired ignored elements never match an inline selector", () => {
  const ignored = (content: string) =>
    `<!--mokly-review-ignore:start:content-->${content}<!--mokly-review-ignore:end:content-->`;
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, ignored('<p class="target"></p>')),
        after: html(styles.after, ignored('<p class="target"></p>')),
      }).result,
    ),
    { kind: "excluded" },
  );
});

test("nesting matches owned descendants and state stripping widens owners", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const nested = {
    before: "<style>.owner{& .target{color:red}}</style>",
    after: "<style>.owner{& .target{color:blue}}</style>",
  };
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(
          nested.before,
          markedRange(0, '<div class="owner"><i class="target"></i></div>'),
        ),
        after: html(
          nested.after,
          markedRange(0, '<div class="owner"><i class="target"></i></div>'),
        ),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    ),
    { kind: "owned", componentIds: ["component"] },
  );

  const pseudo = changedStyle(".target:hover");
  const body = `${markedRange(0, '<button class="target"></button>')}<button class="target"></button>`;
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(pseudo.before, body),
        after: html(pseudo.after, body),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    ),
    { kind: "entry" },
  );
});
