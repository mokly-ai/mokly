import assert from "node:assert/strict";
import test from "node:test";

import { ByteBoundedLru } from "../src/review/css/byte_lru.js";
import { detachSegmentRun } from "../src/review/css/parse_cache.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { cssRuleData } from "../src/review/css/rule_identity.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";

function observed(cacheBytes?: number) {
  const native = new LightningCssRuleParser();
  const batches: (readonly string[])[] = [];
  const whole: string[] = [];
  const analysis = new CssResourceAnalysis(
    {
      parse: (source) => {
        whole.push(source);
        return native.parse(source);
      },
      parseSegments: (segments) => {
        batches.push([...segments]);
        return native.parseSegments(segments);
      },
    },
    undefined,
    cacheBytes,
  );
  return { parser: analysis.parser, batches, whole, native };
}

test("cumulative elements parse each distinct segment once, in one batch per element", () => {
  const { parser, batches, whole, native } = observed();
  const texts = [
    ".a{color:red}",
    ".b{color:blue}",
    "@media screen{.c{display:block}}",
    ".d{}",
  ];
  for (let count = 1; count <= texts.length; count++) {
    const source = texts.slice(0, count).join("\n");
    assert.deepEqual(parser.parseInline!(source), native.parse(source));
  }
  assert.deepEqual(
    batches,
    texts.map((text) => [text]),
  );
  assert.deepEqual(whole, []);
  const fresh = observed();
  assert.equal(fresh.parser.parseInline!(texts.join("\n")).status, "parsed");
  assert.deepEqual(fresh.batches, [texts]);
});

test("successful inline parsing never populates the whole-input cache; linked inputs retain it", () => {
  const { parser, batches, whole } = observed();
  const source = ".a{}\n.b{}";
  parser.parseInline!(source);
  parser.parseInline!(source);
  assert.equal(batches.length, 1);
  assert.deepEqual(whole, []);
  const linked = parser.parse(source);
  assert.equal(parser.parse(source), linked);
  assert.deepEqual(whole, [source]);
  assert.equal(batches.length, 1);
});

test("duplicates share one verified run and ordinals never mutate the cache", () => {
  const { parser, batches, native } = observed();
  for (const source of [".a{} .b{} .a{}", ".b{} .a{}", ".a{} .a{} .a{}"])
    assert.deepEqual(parser.parseInline!(source), native.parse(source));
  assert.deepEqual(batches, [[".a{}", ".b{}"]]);
});

test("formatting keys remain distinct while their cached identity-run keys agree", () => {
  const runs = new LightningCssRuleParser().parseSegments([
    ".a{color:red}",
    ".a { color: red; }",
  ])!;
  assert.equal(runs[0]!.identityRunKey, runs[1]!.identityRunKey);
  assert.deepEqual(
    JSON.parse(runs[0]!.identityRunKey),
    runs[0]!.rules.map((rule) => cssRuleData(rule).identityKey),
  );
});

test("segment accounting includes the identity run and every derived string", () => {
  const run = new LightningCssRuleParser().parseSegments([
    '@media screen{.a{background:url("a.svg")}}',
  ])![0]!;
  const rule = run.rules[0]!;
  const data = cssRuleData(rule);
  const units =
    run.identityRunKey.length +
    rule.declarations.length +
    rule.selectors.reduce((total, selector) => total + selector.length, 0) +
    rule.conditions.reduce(
      (total, condition) =>
        total + condition.kind.length + condition.prelude.length,
      0,
    ) +
    data.addressKey.length +
    data.identityKey.length +
    data.canonicalText.length +
    data.references.reduce((total, reference) => total + reference.length, 0);
  const cache = new ByteBoundedLru(detachSegmentRun);
  const retained = cache.set("key", run);
  assert.equal(cache.estimatedBytes, 64 + 96 + 2 * (3 + units));
  assert.deepEqual(retained, run);
  assert.equal(retained, run);
  assert.ok(Object.isFrozen(retained.rules));
  assert.ok(Object.isFrozen(cssRuleData(retained.rules[0]!).references));
});

test("injected mutable segment runs still detach before retention", () => {
  const native = new LightningCssRuleParser().parse(".a{color:red}");
  assert.ok(native.status === "parsed");
  const run = { rules: [...native.rules], identityRunKey: "injected" };
  const retained = new ByteBoundedLru(detachSegmentRun).set("key", run);
  assert.notEqual(retained, run);
  assert.notEqual(retained.rules[0], run.rules[0]);
  assert.ok(Object.isFrozen(retained));
  assert.ok(Object.isFrozen(retained.rules[0]));
});

test("zero-byte segment caches still reuse duplicates in the current element only", () => {
  const { parser, batches } = observed(0);
  for (let index = 0; index < 2; index++) parser.parseInline!(".a{} .a{}");
  assert.deepEqual(batches, [[".a{}"], [".a{}"]]);
});

test("oversize segments are usable but cannot evict a fitting verified run", () => {
  const native = new LightningCssRuleParser();
  const run = native.parseSegments([".a{}"])![0]!;
  const retained = detachSegmentRun(run);
  const bound = 64 + 96 + 2 * (4 + retained.stringUnits);
  const { parser, batches } = observed(bound);
  parser.parseInline!(".a{}");
  const large = `.oversize{--text:${"x".repeat(1000)}}`;
  parser.parseInline!(large);
  parser.parseInline!(".a{}");
  parser.parseInline!(large);
  assert.deepEqual(batches, [[".a{}"], [large], [large]]);
});

test("segment hits refresh recency and insertions evict until the new run fits", () => {
  const run = new LightningCssRuleParser().parseSegments([".a{}"])![0]!;
  const single = 64 + 96 + 2 * (4 + detachSegmentRun(run).stringUnits);
  const { parser, batches } = observed(2 * single);
  for (const source of [".a{} .b{}", ".a{}", ".c{}", ".a{}", ".b{}"])
    parser.parseInline!(source);
  assert.deepEqual(batches, [[".a{}", ".b{}"], [".c{}"], [".b{}"]]);
});
