import assert from "node:assert/strict";
import test from "node:test";

import { analyzeStylesheetChange } from "../packages/mokly/src/review/css/analyze.js";
import { CssRuleParseError } from "../packages/mokly/src/review/css/types.js";
import type { CssRuleParser } from "../packages/mokly/src/review/css/types.js";

import { analyze, documents, excluded, kept } from "./helpers/review_css.js";

test("CSS analysis excludes no-op, whitespace, comments, and unchanged rule moves", () => {
  for (const [before, after] of [
    ["", "/* comment */"],
    [".button{color:red}", "\n.button { color: red; }"],
    [
      ".button{color:red}body{--tone:red}",
      "body{--tone:red}.button{color:red}",
    ],
  ] as const)
    assert.deepEqual(
      analyzeStylesheetChange(before, after, documents()),
      excluded,
    );
});

test("CSS analysis reduces kept selectors in UTF-16 order without duplicates", () => {
  assert.deepEqual(
    analyze(
      "",
      ".button,.z{color:red}.button{display:block}.unused{color:red}",
    ),
    kept("matched", ".button", ".z"),
  );
  assert.deepEqual(
    analyze("", ".z{--tone:red}.a{--tone:red}.A{--tone:red}.é{--tone:red}"),
    { kind: "kept", status: "unresolved", selectors: [".A", ".a", ".z", ".é"] },
  );
});

test("CSS unresolved evidence dominates matched evidence regardless of rule order", () => {
  for (const css of [
    ".button{color:red}.unused{--tone:red}",
    ".unused{--tone:red}.button{color:red}",
  ])
    assert.deepEqual(
      analyze("", css),
      kept("unresolved", ".button", ".unused"),
    );
  assert.deepEqual(
    analyze("", ".button{color:red}@font-face{font-family:A;src:url(a.woff)}"),
    kept("unresolved", ".button"),
  );
});

test("CSS analysis keeps parse failures on either side without partial evidence", () => {
  for (const [before, after] of [
    [".bad{", ".button{}"],
    [".button{}", ".bad{"],
    [".bad{", ".bad{"],
  ] as const)
    assert.deepEqual(analyze(before, after), kept("unresolved"));
  const parser: CssRuleParser = {
    parse: () => ({
      status: "unresolved",
      error: new CssRuleParseError(new SyntaxError("fixture")),
    }),
  };
  assert.deepEqual(analyze("before", "after", {}, parser), kept("unresolved"));
});

test("CSS analysis composes the injected parser, diff, and document match", () => {
  const calls: string[] = [];
  const parser: CssRuleParser = {
    parse(source) {
      calls.push(source);
      return {
        status: "parsed",
        rules: [
          {
            ordinal: 0,
            selectors: [".button"],
            declarations: source,
            conditions: [],
            hasCustomProperties: false,
          },
        ],
      };
    },
  };
  assert.deepEqual(
    analyzeStylesheetChange("old", "new", documents(), parser),
    kept("matched", ".button"),
  );
  assert.deepEqual(calls, ["old", "new"]);
});
