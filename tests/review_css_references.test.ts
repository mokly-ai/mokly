import assert from "node:assert/strict";
import test from "node:test";

import {
  extractCssReferences,
  mayContainCssReferences,
} from "../src/css_references.js";
import {
  changedReferences,
  cssRuleReferences,
} from "../src/review/css/material.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";
import type { CssRule } from "../src/review/css/types.js";

function parsed(source: string): readonly CssRule[] {
  const result = new LightningCssRuleParser().parse(source);
  assert.equal(result.status, "parsed");
  assert.ok(result.status === "parsed");
  return result.rules;
}

function detected(source: string): readonly string[] {
  return [...new Set(parsed(source).flatMap(cssRuleReferences))];
}

for (const source of [
  String.raw`.target{background:u\72l(icon.svg)}`,
  String.raw`@\69mport "theme.css";`,
  '@import url("theme.css");',
  String.raw`@supports(background-image:u\72l(support.svg)){.target{color:red}}`,
  '@custom url("custom.xml");',
  '@font-face{font-family:"A";src:url("font.woff2")}',
] as const)
  test(`rule and resource discovery agree for ${source}`, () => {
    assert.equal(mayContainCssReferences(source), true);
    assert.deepEqual(detected(source), extractCssReferences(source));
  });

for (const source of [
  ".target{color:red}",
  '.target{content:"url(fake.svg)"}',
  '.target{background:url ("separated.svg")}',
] as const)
  test(`rule and resource discovery both reject ${source}`, () => {
    assert.deepEqual(detected(source), []);
    assert.deepEqual(extractCssReferences(source), []);
  });

test("changed reference detection covers import strings and condition preludes", () => {
  const importBefore = parsed('@import "before.css";')[0]!;
  const importAfter = parsed('@import "after.css";')[0]!;
  assert.equal(changedReferences(importBefore, importAfter), true);
  assert.equal(changedReferences(importBefore, importBefore), false);

  const conditionBefore = parsed(
    "@supports(background:url(before.svg)){.target{color:red}}",
  )[0]!;
  const conditionAfter = parsed(
    "@supports(background:url(after.svg)){.target{color:red}}",
  )[0]!;
  assert.equal(changedReferences(conditionBefore, conditionAfter), true);
});
