import assert from "node:assert/strict";
import test from "node:test";

import { parse, serialize } from "parse5";

import { diffCssRules } from "../src/review/css/diff.js";
import { matchCssRules, prepareCssRule } from "../src/review/css/match.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";
import type { CssRuleParser } from "../src/review/css/types.js";

import {
  analyze,
  buttonDocument,
  documents,
  excluded,
  kept,
} from "./helpers/review_css.js";

test("CSS match excludes unused classes and keeps a matching class", () => {
  assert.deepEqual(analyze("", ".unused { color:red }"), excluded);
  assert.deepEqual(
    analyze("", ".button { color:red }"),
    kept("matched", ".button"),
  );
});

test("CSS match tests both documents for additions, removals, and edits", () => {
  const empty = parse("<!doctype html>");
  const button = parse(buttonDocument);
  for (const pair of [
    { before: empty, after: button },
    { before: button, after: empty },
    { after: button },
    { before: button },
  ]) {
    for (const [before, after] of [
      ["", ".button{color:red}"],
      [".button{color:red}", ""],
      [".button{color:red}", ".button{color:blue}"],
    ] as const)
      assert.deepEqual(
        analyze(before, after, pair),
        kept("matched", ".button"),
      );
  }
  assert.deepEqual(analyze("", ".button{color:red}", {}), excluded);
});

test("CSS match retains one decision per diffed rule and does not mutate its inputs", () => {
  const parser = new LightningCssRuleParser();
  const diff = diffCssRules(
    ".button{color:red}.removed{color:red}",
    ".button{color:blue}.unused{color:red}",
    parser,
  );
  const original = structuredClone(diff);
  const pair = documents();
  const html = serialize(pair.before!);
  const result = matchCssRules(diff, pair);
  assert.equal(result.status, "resolved");
  assert.ok(result.status === "resolved");
  assert.deepEqual(
    result.rules.map(({ change, outcome }) => [change.kind, outcome]),
    [
      ["added", excluded],
      ["removed", excluded],
      ["changed", kept("matched", ".button")],
    ],
  );
  assert.deepEqual(diff, original);
  assert.equal(serialize(pair.before!), html);
});

for (const selector of [
  "*",
  ":root",
  "html",
  "body",
  "body .unused",
  ".unused *",
  ":is(.unused, :root)",
]) {
  test(`CSS match keeps the global construct ${selector} unresolved`, () => {
    assert.deepEqual(
      analyze("", `${selector}{color:red}`, {}),
      kept("unresolved", selector),
    );
  });
}

test("CSS global detection distinguishes classes and literal attribute values", () => {
  for (const selector of [
    ".body",
    "#html",
    '[data-note="*"]',
    '[data-note=":root"]',
  ])
    assert.deepEqual(analyze("", `${selector}{color:red}`), excluded);
});

for (const selector of [
  ":host",
  ":host(.unused)",
  ":host-context(.unused)",
  ".unused::part(label)",
  ".unused::slotted(span)",
]) {
  test(`CSS match keeps shadow-scoped ${selector} unresolved`, () => {
    assert.deepEqual(
      analyze("", `${selector}{color:red}`),
      kept("unresolved", selector),
    );
  });
}

test("CSS matcher failures retain serialized selectors without throwing", () => {
  for (const selector of [
    "[",
    ".unused:unknown-state",
    "svg|a",
    ".unused > > span",
  ]) {
    const parser: CssRuleParser = {
      parse: (source) => ({
        status: "parsed",
        rules: source
          ? [
              {
                ordinal: 0,
                selectors: [selector],
                conditions: [],
                declarations: "color:red",
                hasCustomProperties: false,
              },
            ]
          : [],
      }),
    };
    assert.deepEqual(
      analyze("", "fixture", documents(), parser),
      kept("unresolved", selector),
    );
    assert.deepEqual(
      analyze("", "fixture", {}, parser),
      kept("unresolved", selector),
    );
  }
});

test("CSS match treats conditional rules exactly like unconditional rules", () => {
  for (const wrap of [
    (rule: string) => rule,
    (rule: string) => `@media (width > 99999px){${rule}}`,
    (rule: string) => `@container sidebar (width < 1px){${rule}}`,
    (rule: string) => `@supports (display: unknown){${rule}}`,
    (rule: string) => `@layer base{${rule}}`,
  ]) {
    for (const selector of [".button", ".unused"])
      assert.deepEqual(
        analyze(
          wrap(`${selector}{color:red}`),
          wrap(`${selector}{color:blue}`),
        ),
        selector === ".button" ? kept("matched", selector) : excluded,
      );
  }
});

test("CSS match keeps added, changed, and removed custom properties anywhere", () => {
  for (const [before, after] of [
    ["", ".unused{--tone:red}"],
    [".unused{--tone:red}", ".unused{--tone:blue}"],
    [".unused{--tone:red;color:red}", ".unused{color:red}"],
    [".unused{--tone:red}", ""],
    [
      String.raw`.unused{\2d\2d tone:red}`,
      String.raw`.unused{\2d\2d tone:blue}`,
    ],
    [".unused{--theme:{a:b};color:red}", ".unused{--theme:{a:c};color:red}"],
  ] as const)
    assert.deepEqual(analyze(before, after), kept("unresolved", ".unused"));
});

test("CSS match does not keep an unchanged custom property or URL as unresolved", () => {
  for (const material of [
    "--tone:red",
    "--theme:{a:b}",
    "background:url(icon.svg)",
    'content:"--tone:red;url(icon.svg)"',
  ])
    assert.deepEqual(
      analyze(
        `.unused{${material};color:red}`,
        `.unused{${material};color:blue}`,
      ),
      excluded,
    );
});

test("CSS match keeps selector-less at-rules, including font faces", () => {
  for (const rule of [
    '@font-face{font-family:"A";src:url(a.woff2)}',
    "@keyframes fade{to{opacity:0}}",
    '@property --tone{syntax:"<color>";inherits:true;initial-value:red}',
    '@counter-style ticks{system:cyclic;symbols:"A"}',
    "@page{margin:0}",
    "@unknown feature{.unused{color:red}}",
    '@import "theme.css";',
  ]) {
    assert.deepEqual(analyze("", rule), kept("unresolved"));
    assert.deepEqual(analyze(rule, ""), kept("unresolved"));
  }
});

test("CSS match preserves changed URL references without mistaking string contents", () => {
  for (const [before, after] of [
    ["", ".unused{background:url(a.svg)}"],
    [".unused{background:url(a.svg)}", ".unused{background:url(b.svg)}"],
    [".unused{background:url(a.svg)}", ".unused{color:red}"],
    [
      String.raw`.unused{background:u\72l(a.svg)}`,
      String.raw`.unused{background:u\72l(b.svg)}`,
    ],
    [
      ".unused{background:image-set(url(a.png) 1x)}",
      ".unused{background:image-set(url(b.png) 1x)}",
    ],
  ] as const)
    assert.deepEqual(analyze(before, after), kept("unresolved", ".unused"));
  assert.deepEqual(analyze("", '.unused{content:"url(a.svg)"}'), excluded);
});

test("CSS match preserves changed URL references in unevaluated conditions", () => {
  assert.deepEqual(
    analyze(
      "@supports(background-image:url(a.svg)){.unused{color:red}}",
      "@supports(background-image:url(b.svg)){.unused{color:red}}",
    ),
    kept("unresolved", ".unused"),
  );
});

test("CSS reference detection requires a URL function, not a separated identifier", () => {
  assert.deepEqual(analyze("", '.unused{made-up:url ("a.svg")}'), excluded);
  assert.deepEqual(
    analyze(
      '.unused{background:url("a.svg");color:red}',
      ".unused{background:url(a.svg);color:blue}",
    ),
    excluded,
  );
});

test("CSS keep preparation has one switch for changed inline references", () => {
  const diff = diffCssRules(
    "",
    ".unused{background:url(icon.svg)}",
    new LightningCssRuleParser(),
  );
  assert.equal(diff.status, "resolved");
  assert.ok(diff.status === "resolved");
  const change = { kind: "added" as const, after: diff.added[0]! };
  assert.equal(prepareCssRule(change).status, "unresolved");
  assert.equal(prepareCssRule(change, "matchable").status, "matchable");
});
