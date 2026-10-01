import assert from "node:assert/strict";
import test from "node:test";

import { ByteBoundedLru } from "../src/review/css/byte_lru.js";
import { detachParseResult } from "../src/review/css/parse_cache.js";
import { CssResourceAnalysis } from "../src/review/css/resource_analysis.js";
import { LightningCssRuleParser } from "../src/review/css/rules.js";
import { CssRuleParseError } from "../src/review/css/types.js";
import type { CssRuleParseResult } from "../src/review/css/types.js";

test("whole-input accounting includes every retained rule string slot", () => {
  const shared = "width: 1px;";
  const result: CssRuleParseResult = {
    status: "parsed",
    rules: [
      {
        ordinal: 0,
        declarations: shared,
        selectors: [".a", ".a"],
        conditions: [{ kind: "media", prelude: "screen" }],
        hasCustomProperties: false,
      },
      {
        ordinal: 1,
        declarations: shared,
        selectors: [],
        conditions: [],
        atRule: "import",
        prelude: '"theme.css"',
        block: false,
        hasCustomProperties: false,
      },
    ],
  };
  const units = "parsed".length + shared.length * 2 + 2 * 2 + 5 + 6 + 6 + 11;
  const cache = new ByteBoundedLru(detachParseResult);
  const retained = cache.set("sheet", result);
  assert.deepEqual(retained, result);
  assert.notEqual(retained, result);
  assert.equal(cache.estimatedBytes, 64 + 96 * 2 + 2 * (5 + units));
  assert.ok(Object.isFrozen(retained));
  if (retained.status === "parsed") {
    assert.ok(Object.isFrozen(retained.rules));
    assert.ok(Object.isFrozen(retained.rules[0]?.conditions[0]));
    assert.ok(Object.isFrozen(retained.rules[0]?.selectors));
  }
});

test("safe parse failures are detached, charged and returned identically on hits", () => {
  const error = new CssRuleParseError(new SyntaxError("syntax fixture"));
  const stack = error.stack;
  const cause = error.cause as SyntaxError;
  const causeStack = cause.stack;
  let calls = 0;
  const analysis = new CssResourceAnalysis({
    parse() {
      calls++;
      return { status: "unresolved", error };
    },
  });
  const result = analysis.parser.parse("bad");
  assert.deepEqual(result, { status: "unresolved", error });
  assert.equal(analysis.parser.parse("bad"), result);
  assert.equal(calls, 1);
  assert.equal(result.status, "unresolved");
  if (result.status !== "unresolved") return;
  assert.notEqual(result.error, error);
  assert.equal(result.error.stack, stack);
  assert.equal((result.error.cause as Error).stack, causeStack);
  assert.ok(Object.isFrozen(result.error));
  const cache = new ByteBoundedLru(detachParseResult);
  cache.set("bad", result);
  const errors = [result.error, result.error.cause as Error];
  const units = errors.reduce(
    (sum, value) =>
      sum +
      Object.getOwnPropertyNames(value).reduce((subtotal, key) => {
        const slot = Reflect.get(value, key);
        return (
          subtotal + key.length + (typeof slot === "string" ? slot.length : 0)
        );
      }, 0),
    "unresolved".length,
  );
  assert.equal(cache.estimatedBytes, 64 + 2 * (3 + units));
});

test("native Lightning CSS failure data survives caching unchanged", () => {
  const native = new LightningCssRuleParser();
  const parsed = native.parse("a{notvalid}");
  assert.equal(parsed.status, "unresolved");
  const cache = new ByteBoundedLru(detachParseResult);
  const retained = cache.set("a{notvalid}", parsed);
  assert.notEqual(retained, parsed);
  assert.deepEqual(retained, parsed);
  assert.equal(cache.get("a{notvalid}"), retained);
});

for (const [name, cause] of [
  ["function", () => "opaque"],
  ["class instance", new Map([["source", "opaque"]])],
  ["symbol", Symbol("opaque")],
  ["bigint", 1n],
  [
    "cycle",
    (() => {
      const record: { self?: unknown } = {};
      record.self = record;
      return record;
    })(),
  ],
] as const)
  test(`opaque ${name} failures are never cached`, () => {
    const parsed: CssRuleParseResult = {
      status: "unresolved",
      error: new CssRuleParseError(cause),
    };
    const cache = new ByteBoundedLru(detachParseResult);
    assert.equal(cache.set("bad", parsed), parsed);
    assert.equal(cache.get("bad"), undefined);
    assert.equal(cache.estimatedBytes, 0);
  });

for (const kind of ["accessor", "proxy"] as const)
  test(`opaque ${kind} failures are never cached and their hooks never run`, () => {
    let invocations = 0;
    const cause =
      kind === "accessor"
        ? Object.defineProperty({}, "source", {
            get() {
              invocations++;
              return "opaque";
            },
          })
        : new Proxy(
            {},
            {
              getPrototypeOf() {
                invocations++;
                return Object.prototype;
              },
            },
          );
    const parsed: CssRuleParseResult = {
      status: "unresolved",
      error: new CssRuleParseError(cause),
    };
    const cache = new ByteBoundedLru(detachParseResult);
    assert.equal(cache.set("bad", parsed), parsed);
    assert.equal(cache.get("bad"), undefined);
    assert.equal(cache.estimatedBytes, 0);
    assert.equal(invocations, 0);
  });
