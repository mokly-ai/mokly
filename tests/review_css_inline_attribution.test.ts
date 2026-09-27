import assert from "node:assert/strict";
import test from "node:test";

import { generatedHeader } from "../src/build/ownership.js";
import type { InlineAttributionResult } from "../src/review/css/inline_attribution.js";
import type { InlineRuleAttribution } from "../src/review/css/inline_rule_matching.js";
import { findUnownedInlineStyles } from "../src/review/css/inline_styles.js";
import type { CssRule, CssRuleParser } from "../src/review/css/types.js";
import { normalizeReviewPair } from "../src/review/ignore.js";

import {
  analyzeInline,
  html,
  instance,
  key,
  markedRange,
  range,
  slot,
  view,
} from "./helpers/inline_styles.js";

function changedStyle(selector = ".target") {
  return {
    before: `<style>${selector}{color:red}</style>`,
    after: `<style>${selector}{color:blue}</style>`,
  };
}

function resolved(result: InlineAttributionResult) {
  assert.equal(result.status, "resolved");
  assert.ok(result.status === "resolved");
  return result;
}

function oneAttribution(
  result: InlineAttributionResult,
): InlineRuleAttribution {
  const value = resolved(result);
  assert.equal(value.rules.length, 1);
  return value.rules[0]!.attribution;
}

test("inline rules can be owned by one or two paired components", () => {
  for (const count of [1, 2]) {
    const instances = Array.from({ length: count }, (_, index) =>
      instance(index + 1, `component-${index + 1}`),
    );
    const ranges = instances.map((item, index) =>
      range(index, { kind: "instance", instanceKey: item.key }),
    );
    const body = instances
      .map((_, index) => markedRange(index, '<div class="target"></div>'))
      .join("");
    const usage = view({ instances, ranges });
    const styles = changedStyle();
    const result = resolved(
      analyzeInline({
        before: html(styles.before, body),
        after: html(styles.after, body),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    );
    assert.deepEqual(result.rules[0]?.attribution, {
      kind: "owned",
      componentIds: instances.map(({ componentId }) => componentId),
    });
    assert.deepEqual(
      [...result.ownedComponentIds],
      instances.map(({ componentId }) => componentId),
    );
  }
});

test("an entry match on either side keeps the inline rule with the entry", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(
          styles.after,
          `${markedRange(0, "<div/>")}<div class="target"></div>`,
        ),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    ),
    { kind: "entry" },
  );
});

test("an unpaired matched instance resolves to the entry", () => {
  const beforeInstance = instance(1, "component");
  const afterInstance = instance(2, "component");
  const beforeUsage = view({
    instances: [beforeInstance],
    ranges: [range(0, { kind: "instance", instanceKey: beforeInstance.key })],
  });
  const afterUsage = view({
    instances: [afterInstance],
    ranges: [range(0, { kind: "instance", instanceKey: afterInstance.key })],
  });
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(styles.after, markedRange(0, '<div class="target"/>')),
        beforeUsage,
        afterUsage,
      }).result,
    ),
    { kind: "entry" },
  );
});

test("changed props resolve to the entry or the paired parent input owner", () => {
  const beforeEntryChild = instance(2, "child", { propsKey: key(20) });
  const afterEntryChild = instance(2, "child", { propsKey: key(21) });
  const entryRange = [
    range(0, { kind: "instance", instanceKey: beforeEntryChild.key }),
  ];
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(styles.after, markedRange(0, '<div class="target"/>')),
        beforeUsage: view({
          instances: [beforeEntryChild],
          ranges: entryRange,
        }),
        afterUsage: view({ instances: [afterEntryChild], ranges: entryRange }),
      }).result,
    ),
    { kind: "entry" },
  );

  const parent = instance(1, "parent");
  const owner = { kind: "instance" as const, instanceKey: parent.key };
  const beforeChild = instance(2, "child", { owner, propsKey: key(30) });
  const afterChild = instance(2, "child", { owner, propsKey: key(31) });
  const nestedRanges = [
    range(0, { kind: "instance", instanceKey: parent.key }),
    range(1, { kind: "instance", instanceKey: beforeChild.key }, 0),
  ];
  const body = markedRange(0, markedRange(1, '<div class="target"></div>'));
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, body),
        after: html(styles.after, body),
        beforeUsage: view({
          instances: [parent, beforeChild],
          ranges: nestedRanges,
        }),
        afterUsage: view({
          instances: [parent, afterChild],
          ranges: nestedRanges,
        }),
      }).result,
    ),
    { kind: "owned", componentIds: ["parent"] },
  );
});

test("input-owner recursion fails closed on a cycle", () => {
  const owner = { kind: "instance" as const, instanceKey: key(1) };
  const beforeInstance = instance(1, "component", {
    owner,
    propsKey: key(20),
  });
  const afterInstance = instance(1, "component", {
    owner,
    propsKey: key(21),
  });
  const ranges = [
    range(0, { kind: "instance", instanceKey: beforeInstance.key }),
  ];
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, markedRange(0, '<div class="target"/>')),
        after: html(styles.after, markedRange(0, '<div class="target"/>')),
        beforeUsage: view({ instances: [beforeInstance], ranges }),
        afterUsage: view({ instances: [afterInstance], ranges }),
      }).result,
    ),
    { kind: "entry" },
  );
});

test("root components and entry-owned slots resolve to the entry", () => {
  const root = instance(1, "root");
  const receiver = instance(2, "receiver");
  const entrySlot = slot(10, receiver, { kind: "entry" });
  const styles = changedStyle();
  for (const fixture of [
    {
      body: markedRange(0, '<div class="target"/>'),
      rootComponentId: "root",
      usage: view({
        instances: [root],
        ranges: [range(0, { kind: "instance", instanceKey: root.key })],
      }),
    },
    {
      body: markedRange(0, markedRange(1, '<div class="target"/>')),
      usage: view({
        instances: [receiver],
        slots: [entrySlot],
        ranges: [
          range(0, { kind: "instance", instanceKey: receiver.key }),
          range(1, { kind: "slot", slotKey: entrySlot.key }, 0),
        ],
      }),
    },
  ])
    assert.deepEqual(
      oneAttribution(
        analyzeInline({
          before: html(styles.before, fixture.body),
          after: html(styles.after, fixture.body),
          beforeUsage: fixture.usage,
          afterUsage: fixture.usage,
          ...(fixture.rootComponentId
            ? { rootComponentId: fixture.rootComponentId }
            : {}),
        }).result,
      ),
      { kind: "entry" },
    );
});

test("a slot supplied by a nested paired instance resolves to that component", () => {
  const parent = instance(1, "parent");
  const receiver = instance(2, "receiver", {
    owner: { kind: "instance", instanceKey: parent.key },
  });
  const supplied = slot(10, receiver, {
    kind: "instance",
    instanceKey: parent.key,
  });
  const ranges = [
    range(0, { kind: "instance", instanceKey: parent.key }),
    range(1, { kind: "instance", instanceKey: receiver.key }, 0),
    range(2, { kind: "slot", slotKey: supplied.key }, 1),
  ];
  const body = markedRange(
    0,
    markedRange(1, markedRange(2, '<span class="target"></span>')),
  );
  const usage = view({
    instances: [parent, receiver],
    slots: [supplied],
    ranges,
  });
  const styles = changedStyle();
  assert.deepEqual(
    oneAttribution(
      analyzeInline({
        before: html(styles.before, body),
        after: html(styles.after, body),
        beforeUsage: usage,
        afterUsage: usage,
      }).result,
    ),
    { kind: "owned", componentIds: ["parent"] },
  );
});

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
  ["changed reference", ".missing{background:url(icon.svg)}"],
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

test("historical markers and a generated header keep original span coordinates", () => {
  const item = instance(1, "component");
  const usage = view({
    instances: [item],
    ranges: [range(0, { kind: "instance", instanceKey: item.key })],
  });
  const header = generatedHeader("entries/fixture.mockup.tsx");
  const styles = changedStyle();
  const historicalIgnored =
    "<!--mokabook-review-ignore:start:legacy--><style>.ignored{color:red}</style><!--mokabook-review-ignore:end:legacy-->";
  const currentIgnored =
    "<!--mokly-review-ignore:start:legacy--><style>.ignored{color:blue}</style><!--mokly-review-ignore:end:legacy-->";
  const before = `${header}${html(
    styles.before,
    `${markedRange(0, '<div class="target"></div>', "historical")}${historicalIgnored}`,
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

test("one-sided material evidence removes an otherwise paired ignore id", () => {
  const region =
    "<!--mokly-review-ignore:start:styles--><style>.a{}</style><!--mokly-review-ignore:end:styles-->";
  const material = `<!--mokly-review-material:styles:${key(99)}-->`;
  const pair = normalizeReviewPair(region, `${region}${material}`, "test.html");
  assert.deepEqual(pair.pairedIgnoreIds, []);
});
