import assert from "node:assert/strict";
import test from "node:test";

import { LightningCssRuleParser } from "../packages/mokly/src/review/css/rules.js";
import type { CssRule } from "../packages/mokly/src/review/css/types.js";

const parser = new LightningCssRuleParser();

function rules(css: string): readonly CssRule[] {
  const result = parser.parse(css);
  assert.equal(result.status, "parsed");
  assert.ok(result.status === "parsed");
  return result.rules;
}

test("CSS rules retain source ordinals, selector order, and declaration order", () => {
  assert.deepEqual(
    rules(".b, :is(.a, .c) { color: red; display: block; } .d {}"),
    [
      {
        ordinal: 0,
        selectors: [".b", ":is(.a, .c)"],
        declarations: "color:red;display:block",
        conditions: [],
        hasCustomProperties: false,
      },
      {
        ordinal: 1,
        selectors: [".d"],
        declarations: "",
        conditions: [],
        hasCustomProperties: false,
      },
    ],
  );
});

test("CSS parsing normalizes whitespace and comments without optimizing declarations", () => {
  assert.deepEqual(
    rules("/*! license */ .a { color : red; /* note */ padding: 1px  2px; }"),
    rules(".a{color:red;padding:1px 2px}"),
  );
  assert.equal(
    rules(
      ".a { color:red!important; display:block; color:blue; padding:1px; padding-left:2px; }",
    )[0]?.declarations,
    "color:red!important;display:block;color:blue;padding:1px;padding-left:2px",
  );
});

test("CSS serialization preserves strings, token boundaries, and escapes", () => {
  const [rule] = rules(
    String.raw`.a\,b, [data-note="{,}"] { content: "a  b/*literal*/;{}"; --x: foo/**/bar; --y: foo bar; --z: foobar; }`,
  );
  assert.deepEqual(rule?.selectors, [String.raw`.a\,b`, '[data-note="{,}"]']);
  assert.equal(
    rule?.declarations,
    'content:"a  b/*literal*/;{}";--x:foo bar;--y:foo bar;--z:foobar',
  );
  assert.equal(rule?.hasCustomProperties, true);
});

test("CSS custom property detection distinguishes unknown ordinary properties", () => {
  assert.equal(rules(".a { made-up: value; }")[0]?.hasCustomProperties, false);
  assert.equal(
    rules(String.raw`.a { \2d\2d tone: red !important; }`)[0]
      ?.hasCustomProperties,
    true,
  );
  assert.equal(
    rules(".a { content: '--not-a-property'; }")[0]?.hasCustomProperties,
    false,
  );
});

test("CSS rules preserve the ordered enclosing conditions without evaluating them", () => {
  const [rule] = rules(`@layer theme.controls {
    @media screen and (min-width: 10px) {
      @container sidebar (width > 2px) {
        @supports (display: grid) { .a { color:red; } }
      }
    }
  }`);
  assert.deepEqual(rule?.conditions, [
    { kind: "layer", prelude: "theme.controls" },
    { kind: "media", prelude: "screen and (width >= 10px)" },
    { kind: "container", prelude: "sidebar (width > 2px)" },
    { kind: "supports", prelude: "(display: grid)" },
  ]);
  assert.deepEqual(rules("@media all { .a{} }")[0]?.conditions, [
    { kind: "media", prelude: "all" },
  ]);
  assert.deepEqual(rules("@layer { .a{} }")[0]?.conditions, [
    { kind: "layer", prelude: "" },
  ]);
});

test("CSS nesting retains parents and interleaved declaration runs", () => {
  const parsed = rules(`/* 🙂 */ .outer, .other { color:red;
    @media (min-width:10px) { color:blue; .inner { color:green; } }
    background:white; &:hover { color:black; }
  } .last { color:red; }`);
  assert.deepEqual(
    parsed.map((rule) => rule.ordinal),
    [0, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    parsed.map((rule) => rule.declarations),
    [
      "color:red",
      "color:blue",
      "color:green",
      "background:white",
      "color:black",
      "color:red",
    ],
  );
  const parent = { kind: "nesting-parent", prelude: ".outer, .other" };
  assert.deepEqual(parsed[1]?.selectors, ["&"]);
  assert.deepEqual(parsed[2]?.selectors, ["& .inner"]);
  assert.deepEqual(parsed[2]?.conditions, [
    parent,
    { kind: "media", prelude: "(width >= 10px)" },
  ]);
  assert.deepEqual(parsed[3]?.conditions, [parent]);
  assert.deepEqual(parsed[4]?.selectors, ["&:hover"]);
  assert.deepEqual(parsed[5]?.conditions, []);
});

test("CSS selector-less at-rules retain names, preludes, and their complete bodies", () => {
  const parsed = rules(`@charset "utf-8";
    @import "theme.css" layer(theme);
    @namespace svg url("http://www.w3.org/2000/svg");
    @font-face { font-family: "A"; src: url(a.woff2); }
    @keyframes fade { from { opacity:0; } to { opacity:1; } }
    @property --tone { syntax: "<color>"; inherits:true; initial-value:red; }
    @counter-style ticks { system:cyclic; symbols:"A"; }
    @page :first { margin:0; @top-left { content:"Title"; } }
    @layer reset, theme;
    @future feature { .a :hover { --tone:blue; } }
    @scope (.area) { .a { color:red; } }
    @starting-style { .a { opacity:0; } }`);
  assert.deepEqual(
    parsed.map((rule) => rule.atRule),
    [
      "charset",
      "import",
      "namespace",
      "font-face",
      "keyframes",
      "property",
      "counter-style",
      "page",
      "layer",
      "future",
      "scope",
      "starting-style",
    ],
  );
  assert.ok(parsed.every((rule) => rule.selectors.length === 0));
  assert.equal(parsed[4]?.prelude, "fade");
  assert.equal(parsed[4]?.declarations, "from{opacity:0}to{opacity:1}");
  assert.equal(parsed[7]?.declarations, 'margin:0;@top-left{content:"Title"}');
  assert.equal(parsed[9]?.declarations, ".a :hover{--tone:blue}");
});

test("CSS source locations handle Unicode, multiline comments, and CRLF", () => {
  const parsed = rules(
    '/* 🙂\r\n comment */\r\n.é { content:"🙂"; }\r\n@media all { .次 { color:red; } }',
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.declarations, 'content:"🙂"');
  assert.equal(parsed[1]?.declarations, "color:red");
});

test("CSS sibling conditions and deeper nesting do not leak into later rules", () => {
  const parsed = rules(
    ".a { @supports (display:grid) { @container (width>1px) { --x:red; } } .b { &:hover { color:red; } } } .last{}",
  );
  assert.deepEqual(parsed[1]?.selectors, ["&"]);
  assert.equal(parsed[1]?.hasCustomProperties, true);
  assert.deepEqual(
    parsed[1]?.conditions.map(({ kind }) => kind),
    ["nesting-parent", "supports", "container"],
  );
  assert.deepEqual(parsed[3]?.conditions, [
    { kind: "nesting-parent", prelude: ".a" },
    { kind: "nesting-parent", prelude: "& .b" },
  ]);
  assert.deepEqual(parsed.at(-1)?.conditions, []);
});

test("CSS source keeps custom token blocks, URLs, priorities, and escaped delimiters", () => {
  const [rule] = rules(
    String.raw`.a { --tokens: { x: y; inner: { a: b } }; background:url("data:text/plain;{},a"); width:calc(1px + 2px); color:red ! important; --end:\}; }`,
  );
  assert.equal(
    rule?.declarations,
    String.raw`--tokens:{x:y;inner:{a:b}};background:url("data:text/plain;{},a");width:calc(1px + 2px);color:red!important;--end:\}`,
  );
  assert.equal(rule?.hasCustomProperties, true);
});

test("CSS parsing accepts a BOM, encoding statement, and legacy HTML comment boundaries", () => {
  assert.deepEqual(
    rules('\uFEFF@charset "utf-8"; <!-- .a{} -->'),
    rules('@charset "utf-8"; .a{}'),
  );
  assert.deepEqual(rules(".\u00a0{}")[0]?.selectors, [".\u00a0"]);
});

test("CSS native serialization retains nullable selector and at-rule options", () => {
  const parsed = rules(
    '@namespace svg url("https://example.invalid/svg"); @layer { svg|a[href], :nth-child(2n + 1), :host(.x), ::part(label) { color:red; } } @-webkit-keyframes spin { to { opacity:1 } }',
  );
  assert.deepEqual(parsed[1]?.selectors, [
    "svg|a[href]",
    ":nth-child(odd)",
    ":host(.x)",
    "::part(label)",
  ]);
  assert.equal(parsed[2]?.atRule, "-webkit-keyframes");
});

test("CSS parse failure is typed and does not expose partially parsed rules", () => {
  for (const css of [
    ".good{} .bad { color red; }",
    ".a { color:red",
    ".a { content: 'unterminated; }",
  ]) {
    const result = parser.parse(css);
    assert.equal(result.status, "unresolved");
    assert.ok(result.status === "unresolved");
    assert.equal(result.error.code, "css-parse-failed");
    assert.equal("rules" in result, false);
  }
});
