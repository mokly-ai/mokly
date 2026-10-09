import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "parse5";

import { diffCssRules } from "../dist/review/css/diff.js";
import { matchCssRules } from "../dist/review/css/match.js";
import { LightningCssRuleParser } from "../dist/review/css/rules.js";

test("rule matching retains every element, selector and side", () => {
  const document = parse(
    '<!doctype html><p class="a">First</p><p class="a b">Second</p>',
    { sourceCodeLocationInfo: true },
  );
  const result = matchCssRules(
    diffCssRules("", ".a,.b{color:red}", new LightningCssRuleParser()),
    { before: document, after: document },
  );
  assert.ok(result.status === "resolved");
  assert.equal(result.rules[0]!.matches.length, 6);
  assert.deepEqual(
    result.rules[0]!.matches.map((match) => match.selector),
    [".a", ".a", ".a", ".a", ".b", ".b"],
  );
  assert.ok(
    result.rules[0]!.matches.every(
      (match) =>
        match.element.sourceCodeLocation && match.document === document,
    ),
  );
});

test("nested matching retains the original ampersand selector", () => {
  const result = matchCssRules(
    diffCssRules(
      ".a{& .b{color:red}}",
      ".a{& .b{color:blue}}",
      new LightningCssRuleParser(),
    ),
    { after: parse('<div class="a"><b class="b">Text</b></div>') },
  );
  assert.ok(result.status === "resolved");
  assert.equal(result.rules[0]!.matches[0]!.selector, "& .b");
});
