import assert from "node:assert/strict";
import test from "node:test";

import { diffCssRules } from "../packages/mokly/src/review/css/diff.js";
import { LightningCssRuleParser } from "../packages/mokly/src/review/css/rules.js";
import { CssRuleParseError } from "../packages/mokly/src/review/css/types.js";
import type {
  CssRule,
  CssRuleParser,
} from "../packages/mokly/src/review/css/types.js";

const parser = new LightningCssRuleParser();
const empty = { status: "resolved", added: [], removed: [], changed: [] };

function diff(before: string, after: string) {
  const result = diffCssRules(before, after, parser);
  assert.ok(result.status === "resolved");
  return result;
}

test("CSS whitespace-only and comment-only edits yield no diffed rules", () => {
  assert.deepEqual(diff(".a { color: red; }", "\n.a{color:red}\n"), empty);
  assert.deepEqual(
    diff(".a{color:red}", "/*! license */.a{/*color*/color:red}/* end */"),
    empty,
  );
  assert.deepEqual(diff("", "/* nothing */\n"), empty);
  assert.deepEqual(
    diff(
      "@media (min-width: 1px){.a{color:red}}",
      "@media ( min-width : 1px ) { .a { color : red; } }",
    ),
    empty,
  );
});

test("CSS added and removed rules use the ordinals on their own side", () => {
  const added = diff(".a{}", ".b{} .a{} .c{}");
  assert.deepEqual(
    added.added.map((rule) => [rule.ordinal, rule.selectors]),
    [
      [0, [".b"]],
      [2, [".c"]],
    ],
  );
  assert.equal(added.removed.length, 0);
  assert.equal(added.changed.length, 0);
  const removed = diff(".b{} .a{} .c{}", ".a{}");
  assert.deepEqual(removed.removed, added.added);
  assert.equal(removed.added.length, 0);
});

test("CSS declaration changes retain both sides, sorted by after ordinal", () => {
  const result = diff(
    ".a{color:red}.b{color:black}",
    ".b{color:white}.a{color:blue}",
  );
  assert.equal(result.added.length, 0);
  assert.equal(result.removed.length, 0);
  assert.deepEqual(
    result.changed.map(({ before, after }) => [
      before.ordinal,
      after.ordinal,
      before.declarations,
      after.declarations,
    ]),
    [
      [1, 0, "color:black", "color:white"],
      [0, 1, "color:red", "color:blue"],
    ],
  );
});

test("CSS rule moves are unchanged, including repeated selectors with different declarations", () => {
  assert.deepEqual(
    diff(".a{color:red}.b{}.a{color:blue}", ".a{color:blue}.a{color:red}.b{}"),
    empty,
  );
});

test("CSS duplicate rules are counted and exact matches are removed before changed pairing", () => {
  const result = diff(
    ".a{color:red}.a{color:blue}.a{color:red}",
    ".a{color:green}.a{color:red}",
  );
  assert.deepEqual(
    result.changed.map(({ before, after }) => [
      before.declarations,
      after.declarations,
    ]),
    [["color:blue", "color:green"]],
  );
  assert.deepEqual(
    result.removed.map((rule) => [rule.ordinal, rule.declarations]),
    [[2, "color:red"]],
  );
  assert.equal(diff(".a{}", ".a{}.a{}").added.length, 1);
});

test("CSS changed conditions, selector order, and nesting parents are removed and added", () => {
  for (const [before, after] of [
    ["@media (width>1px){.a{color:red}}", "@media (width>2px){.a{color:red}}"],
    [".a,.b{}", ".b,.a{}"],
    [".outer{.child{color:red}}", ".other{.child{color:red}}"],
  ]) {
    const result = diff(before!, after!);
    assert.equal(result.changed.length, 0);
    assert.ok(result.added.length > 0);
    assert.equal(result.added.length, result.removed.length);
  }
});

test("CSS declaration order, duplicate declarations, and meaningful spaces are material", () => {
  for (const [before, after] of [
    [".a{color:red;display:block}", ".a{display:block;color:red}"],
    [
      ".a{color:red!important;display:block}",
      ".a{display:block;color:red!important}",
    ],
    [".a{color:red;color:red}", ".a{color:red}"],
    ['.a{content:"a  b"}', '.a{content:"a b"}'],
    [".a{--x:foo bar}", ".a{--x:foobar}"],
  ])
    assert.equal(diff(before!, after!).changed.length, 1);
  const selector = diff(".a .b{}", ".a.b{}");
  assert.equal(selector.added.length, 1);
  assert.equal(selector.removed.length, 1);
});

test("CSS selector-less identities retain at-rule names and preludes", () => {
  const renamed = diff(
    "@keyframes fade{to{opacity:0}}",
    "@keyframes appear{to{opacity:0}}",
  );
  assert.equal(renamed.added.length, 1);
  assert.equal(renamed.removed.length, 1);
  assert.equal(renamed.changed.length, 0);
  const body = diff(
    "@keyframes fade{to{opacity:0}}",
    "@keyframes fade{to{opacity:1}}",
  );
  assert.equal(body.changed.length, 1);
  assert.equal(body.changed[0]?.after.atRule, "keyframes");
  assert.deepEqual(
    diff(
      '@font-face { font-family : "A"; src : url(a.woff); }',
      '@font-face{font-family:"A";src:url(a.woff)}',
    ),
    empty,
  );
  assert.deepEqual(
    diff(
      "@keyframes fade { from { opacity : 0; } }",
      "@keyframes fade{from{opacity:0}}",
    ),
    empty,
  );
  assert.equal(diff("@future x{}", "@another x{}").changed.length, 0);
  assert.equal(diff("@import 'a.css';", "@import 'b.css';").added.length, 1);
});

test("CSS diff accepts injected rule fixtures without parsing their input strings", () => {
  const rule: CssRule = {
    ordinal: 4,
    selectors: [".fixture"],
    declarations: "color:red",
    conditions: [],
    hasCustomProperties: false,
  };
  const calls: string[] = [];
  const fixture: CssRuleParser = {
    parse(source) {
      calls.push(source);
      return {
        status: "parsed",
        rules:
          source === "before"
            ? [rule]
            : [{ ...rule, ordinal: 2, declarations: "color:blue" }],
      };
    },
  };
  const result = diffCssRules("before", "after", fixture);
  assert.deepEqual(calls, ["before", "after"]);
  assert.deepEqual(result, {
    status: "resolved",
    added: [],
    removed: [],
    changed: [
      {
        before: rule,
        after: { ...rule, ordinal: 2, declarations: "color:blue" },
      },
    ],
  });
});

test("CSS diff reports one or both parse failures as unresolved without throwing", () => {
  for (const [before, after, sides] of [
    [".a{color red}", ".a{}", ["before"]],
    [".a{}", ".a{color red}", ["after"]],
    [".a{color red}", ".a{color blue}", ["before", "after"]],
  ] as const) {
    const result = diffCssRules(before, after, parser);
    assert.ok(result.status === "unresolved");
    assert.deepEqual(
      result.failures.map((failure) => failure.side),
      sides,
    );
    assert.ok(
      result.failures.every(
        (failure) => failure.error instanceof CssRuleParseError,
      ),
    );
    assert.equal("added" in result, false);
  }
  const error = new CssRuleParseError(new SyntaxError("fixture failure"));
  const fixture: CssRuleParser = {
    parse: () => ({ status: "unresolved", error }),
  };
  const unresolved = diffCssRules("before", "after", fixture);
  assert.ok(unresolved.status === "unresolved");
  assert.equal(unresolved.failures[0]?.error, error);
});

test("CSS diff contains an unexpected exception from an injected parser", () => {
  const fixture: CssRuleParser = {
    parse: () => {
      throw new SyntaxError("fixture failure");
    },
  };
  assert.equal(diffCssRules("before", "after", fixture).status, "unresolved");
});

test("CSS nested rule moves and condition formatting alone produce no diff", () => {
  assert.deepEqual(
    diff(
      ".a { .b{color:red} .c{color:blue} }",
      ".a{.c{color:blue}.b{color:red}}",
    ),
    empty,
  );
  assert.deepEqual(
    diff(
      "@supports (display:grid){@container x (width>1px){.a{color:red}}}",
      "@supports ( display : grid ) { @container x ( width > 1px ) { .a { color : red } } }",
    ),
    empty,
  );
});

test("CSS opaque bodies preserve significant selector whitespace and custom property removal", () => {
  assert.equal(
    diff("@future x{.a :hover{color:red}}", "@future x{.a:hover{color:red}}")
      .changed.length,
    1,
  );
  const result = diff(".a{--tone:red;color:red}", ".a{color:red}");
  assert.equal(result.changed[0]?.before.hasCustomProperties, true);
  assert.equal(result.changed[0]?.after.hasCustomProperties, false);
});

test("CSS value separators normalize without creating comment delimiters", () => {
  assert.deepEqual(
    diff(
      ".a{font:12px / 2 serif;transform:translate( 1px , 2px )}",
      ".a{font:12px/2 serif;transform:translate(1px,2px)}",
    ),
    empty,
  );
  assert.equal(diff(".a{--x:/ *}", ".a{--x:/**/}").changed.length, 1);
});

test("CSS comment removal preserves token boundaries and literal URL content", () => {
  assert.equal(diff(".a{color:#fff}", ".a{color:#/**/fff}").changed.length, 1);
  assert.equal(
    diff(
      ".a{background:url(img/*version*/icon.svg)}",
      ".a{background:url(imgicon.svg)}",
    ).changed.length,
    1,
  );
  assert.deepEqual(
    diff(".a{background:url( icon.svg )}", ".a{background:url(icon.svg)}"),
    empty,
  );
});
