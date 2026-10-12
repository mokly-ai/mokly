import assert from "node:assert/strict";
import test from "node:test";

import { diffCssRuleLists } from "../src/review/css/diff.js";
import { renderInlineRules } from "../src/review/css/inline_rendering.js";
import { cssRuleReferences } from "../src/review/css/material.js";
import {
  cssRuleData,
  cssRuleIdentity,
  rebaseCssRule,
} from "../src/review/css/rule_identity.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

test("both native paths store one immutable derived value per rule", () => {
  const parser = new LightningCssRuleParser();
  const source =
    '@supports (background:url("condition.svg")){.a{--tone:red;background:url("image.svg")}}';
  const whole = parser.parse(source);
  const segment = parser.parseSegments([source])![0]!;
  assert.ok(whole.status === "parsed");
  assert.deepEqual(segment.rules, whole.rules);
  for (const rule of [...segment.rules, ...whole.rules]) {
    const data = cssRuleData(rule);
    assert.equal(cssRuleData(rule), data);
    assert.equal(cssRuleData(rebaseCssRule(rule, 20)), data);
    assert.equal(cssRuleIdentity(rule), data.identityKey);
    assert.equal(cssRuleReferences(rule), data.references);
    assert.deepEqual(data.references, ["condition.svg", "image.svg"]);
    assert.equal(rule.hasCustomProperties, true);
    assert.ok(Object.isFrozen(data));
    assert.ok(Object.isFrozen(data.references));
  }
});

test("consumers use stored keys, text and references rather than inspecting raw material again", () => {
  const parsed = new LightningCssRuleParser().parse(".a{color:red}");
  assert.ok(parsed.status === "parsed");
  const rule = parsed.rules[0]!;
  const data = cssRuleData(rule);
  for (const key of [
    "conditions",
    "selectors",
    "declarations",
    "atRule",
    "prelude",
    "block",
  ])
    Object.defineProperty(rule, key, {
      get: () => {
        throw new Error(`recomputed ${key}`);
      },
    });
  assert.equal(cssRuleIdentity(rule), data.identityKey);
  assert.equal(cssRuleReferences(rule), data.references);
  assert.equal(renderInlineRules([rule]), data.canonicalText);
  assert.deepEqual(diffCssRuleLists([rule], [rule]), {
    status: "resolved",
    added: [],
    removed: [],
    changed: [],
  });
});

test("statement form, decoded leading rank and string imports have stored definitions", () => {
  const parser = new LightningCssRuleParser();
  const parsed = parser.parse('@import "theme.css";@layer a;@layer a{}');
  assert.ok(parsed.status === "parsed");
  assert.deepEqual(
    parsed.rules.map((rule) => cssRuleData(rule).rank),
    [1, 3, 4],
  );
  assert.deepEqual(cssRuleReferences(parsed.rules[0]), ["theme.css"]);
  const statement = cssRuleData(parsed.rules[1]!);
  const block = cssRuleData(parsed.rules[2]!);
  assert.deepEqual(JSON.parse(statement.addressKey), [
    [],
    [],
    "layer",
    "a",
    false,
  ]);
  assert.deepEqual(JSON.parse(block.addressKey), [[], [], "layer", "a", true]);
  assert.equal(statement.canonicalText, "@layer a;");
  assert.equal(block.canonicalText, "@layer a{}");
  const escaped = rebaseCssRule(parsed.rules[0]!, 99);
  assert.ok(escaped.atRule !== undefined);
  const raw = { ...escaped, atRule: String.raw`\69mport` };
  assert.equal(cssRuleData(raw).rank, 1);
  assert.deepEqual(cssRuleReferences(raw), ["theme.css"]);
});

test("unknown at-rule names never inherit a leading rank from object prototypes", () => {
  const parsed = new LightningCssRuleParser().parse(
    "@constructor;@toString;@__proto__;",
  );
  assert.ok(parsed.status === "parsed");
  assert.deepEqual(
    parsed.rules.map((rule) => cssRuleData(rule).rank),
    [4, 4, 4],
  );
});
