import assert from "node:assert/strict";
import test from "node:test";

import { diffCssRuleLists } from "../src/review/css/diff.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

import { compareInlineOracle } from "./helpers/inline_analysis_oracle.js";
import {
  html,
  inlineInput,
  instance,
  markedRange,
  range,
  view,
} from "./helpers/inline_styles.js";

const cases = [
  [
    "flat displacement example",
    [".a {color:red}", ".a{color:blue}", ".a{color:red}"],
    [".a{color:red}", ".a{color:green}"],
  ],
  [
    "format-only duplicates",
    [".a {color:red}", ".a{color:red}", ".b{}"],
    [".a{color:red}", ".b { }", ".a {color:red}"],
  ],
  [
    "element splitting",
    [".a{color:red}.b{color:blue}.a{color:red}"],
    [".a {color:red}", ".b{color:blue}", ".a{color:red}"],
  ],
  [
    "moved unchanged reference",
    ['.a{background:url("a.svg")}', ".owned{color:red}"],
    [".owned{color:blue}", '.a{background:url("a.svg")}'],
  ],
  [
    "unchanged reference in survivor run",
    ['@media screen{.a{background:url("a.svg")}.owned{color:red}}'],
    ['@media screen{.a{background:url("a.svg")}.owned{color:blue}}'],
  ],
  [
    "custom property",
    [".a{--tone:red}.owned{color:red}"],
    [".a{--tone:blue}.owned{color:blue}"],
  ],
  [
    "nested changed",
    [".a{color:red;& .owned{padding:1px}}"],
    [".a{color:red;& .owned{padding:2px}}"],
  ],
  [
    "conditional changed",
    ["@media screen{@supports (display:grid){@layer a{.owned{color:red}}}}"],
    ["@media screen{@supports (display:grid){@layer a{.owned{color:blue}}}}"],
  ],
  [
    "canonical rank and identity order",
    ["@layer z;", ".b{color:red}", "@layer a{}", ".a{color:red}"],
    [".a{color:blue}", "@layer a{}", ".b{color:red}", "@layer z;"],
  ],
  [
    "removed and added unrelated rules",
    [".missing{color:red}.a{padding:1px}"],
    [".other{color:blue}.a{padding:2px}"],
  ],
] as const;

const component = instance(1, "action");
const usage = view({
  instances: [component],
  ranges: [range(0, { kind: "instance", instanceKey: component.key })],
});
const body = `<main class="a b"></main>${markedRange(0, '<button class="owned"></button>')}`;

for (const [name, before, after] of cases)
  for (const bound of [undefined, 0])
    test(`${name}: M4 ordered diff, attributions and materials at bound ${bound}`, () => {
      compareInlineOracle(
        inlineInput({
          before: html(
            before.map((text) => `<style>${text}</style>`).join(""),
            body,
          ),
          after: html(
            after.map((text) => `<style>${text}</style>`).join(""),
            body,
          ),
          beforeUsage: usage,
          afterUsage: usage,
          parser: new CssResourceAnalysis(undefined, undefined, bound).parser,
        }),
        name,
      );
    });

for (const side of ["before", "after"] as const)
  test(`${side} whole-element fallback disables cancellation for the entire side pair`, () => {
    const native = new LightningCssRuleParser();
    const whole: string[] = [];
    const input = inlineInput({
      before: html(
        `${side === "before" ? '<style>@import "t.css";</style>' : ""}<style>.a{color:red}.b{color:black}</style><style>.c{color:green}</style>`,
        body,
      ),
      after: html(
        `${side === "after" ? '<style>@import "t.css";</style>' : ""}<style>.a{color:blue}.b{color:black}</style><style>.c{color:green}</style>`,
        body,
      ),
      beforeUsage: usage,
      afterUsage: usage,
      parser: new CssResourceAnalysis({
        parse: (text) => {
          whole.push(text);
          return native.parse(text);
        },
        parseSegments: (texts) => native.parseSegments(texts),
      }).parser,
    });
    let sizes: number[] = [];
    input.diffRules = (base, head) => {
      sizes = [base.length, head.length];
      return diffCssRuleLists(base, head);
    };
    const actual = compareInlineOracle(input);
    assert.equal(actual.status, "resolved");
    assert.deepEqual(sizes, side === "before" ? [4, 3] : [3, 4]);
    assert.ok(whole.length > 0);
  });

for (const side of ["before", "after"] as const)
  test(`${side} whole-element fallback preserves full-diff grouped entry attribution`, () => {
    const group = "@media screen{.a{--tone:red;color:red}.b{color:black}}";
    const fallback = '<style>@import "t.css";</style>';
    const result = compareInlineOracle(
      inlineInput({
        before: html(
          `${side === "before" ? fallback : ""}<style>@media screen{.a{--tone:red;color:red}}@media screen{.a{--tone:blue;color:blue}}${group}</style>`,
          '<main class="a"></main>',
        ),
        after: html(
          `${side === "after" ? fallback : ""}<style>${group}@media screen{.a{--tone:blue;color:green}}</style>`,
          '<main class="a"></main>',
        ),
      }),
    );
    assert.ok(result.status === "resolved");
    const changed = result.rules.filter(
      ({ change }) => change.kind === "changed",
    );
    assert.equal(changed.length, 1);
    assert.equal(changed[0]!.attribution.kind, "entry");
    assert.equal(
      changed[0]!.change.before?.declarations,
      "--tone:blue;color:blue",
    );
    assert.equal(changed[0]!.change.before?.ordinal, side === "before" ? 2 : 1);
  });

for (const side of ["before", "after"] as const)
  test(`${side} unresolved parsing keeps both elements verbatim with the M4 failure`, () => {
    const source = {
      before: ".a{color:red}",
      after: ".a{color:blue}",
      [side]: ".a{broken}",
    };
    assert.equal(
      compareInlineOracle(
        inlineInput({
          before: html(`<style>${source.before}</style>`, body),
          after: html(`<style>${source.after}</style>`, body),
          beforeUsage: usage,
          afterUsage: usage,
        }),
      ).status,
      "unresolved",
    );
  });
