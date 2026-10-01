import assert from "node:assert/strict";

import { ByteBoundedLru } from "../../src/review/css/byte_lru.js";
import { detachParseResult } from "../../src/review/css/parse_cache.js";
import { CssRuleParseError } from "../../src/review/css/types.js";

const [slot, mode] = process.argv.slice(2);
const errorSlot = slot.startsWith("error-");
const cache =
  mode === "sliced-control" ? new Map() : new ByteBoundedLru(detachParseResult);
const collect = () => {
  for (let attempt = 0; attempt < 4; attempt++) global.gc();
  return process.memoryUsage().heapUsed;
};
const baseline = collect();
const populated = populate();
const retained = collect();
const result = cache.get(slot.startsWith("key") ? "你".repeat(1024) : "key");
assert.ok(result);
assert.equal(cache.size, 1);
const units =
  slot === "condition-kind"
    ? "nesting-parent"
    : slot === "error-code"
      ? "css-parse-failed"
      : "你".repeat(1024);
if (errorSlot) {
  assert.equal(result.status, "unresolved");
  const error = result.error;
  const value =
    slot === "error-payload"
      ? error.cause.payload[0].source
      : slot === "error-property-key"
        ? Object.keys(error.cause)[0]
        : error[slot.slice("error-".length)];
  assert.equal(value, units);
} else if (!slot.startsWith("key")) {
  assert.equal(result.status, "parsed");
  const rule = result.rules[0];
  const value =
    slot === "selector"
      ? rule.selectors[0]
      : slot === "condition-prelude"
        ? rule.conditions[0].prelude
        : slot === "condition-kind"
          ? rule.conditions[0].kind
          : rule[slot];
  assert.equal(value, units);
}
process.stdout.write(
  JSON.stringify({
    allocatedBytes: populated - baseline,
    releasedBytes: populated - retained,
    retainedBytes: retained - baseline,
  }),
);

function populate() {
  if (slot === "key-hit")
    cache.set("你".repeat(1024), { status: "parsed", rules: [] });
  const prefix =
    slot === "condition-kind"
      ? "nesting-parent"
      : slot === "error-code"
        ? "css-parse-failed"
        : "";
  const parent = prefix + "你".repeat(24 * 1024 * 1024);
  assert.equal(parent.charCodeAt(parent.length - 1), "你".charCodeAt(0));
  const sliced = parent.slice(0, prefix.length || 1024);
  const rule = {
    ordinal: 0,
    declarations: "color: red;",
    selectors: [".fixture"],
    conditions: [{ kind: "media", prelude: "screen" }],
    hasCustomProperties: false,
  };
  if (slot === "selector") rule.selectors = [sliced];
  else if (slot === "condition-prelude") rule.conditions[0].prelude = sliced;
  else if (slot === "condition-kind") rule.conditions[0].kind = sliced;
  else if (slot === "declarations") rule.declarations = sliced;
  else if (slot === "atRule" || slot === "prelude") {
    rule.selectors = [];
    rule.atRule = slot === "atRule" ? sliced : "import";
    rule.prelude = slot === "prelude" ? sliced : "theme.css";
    rule.block = false;
  }
  let value = { status: "parsed", rules: [rule] };
  if (errorSlot) {
    const cause =
      slot === "error-payload"
        ? { payload: [{ source: sliced }] }
        : slot === "error-property-key"
          ? { [sliced]: true }
          : "fixture";
    const error = new CssRuleParseError(cause);
    if (slot !== "error-payload" && slot !== "error-property-key")
      Object.defineProperty(error, slot.slice("error-".length), {
        value: sliced,
        configurable: true,
        writable: true,
      });
    value = { status: "unresolved", error };
  }
  if (slot === "key-hit") assert.ok(cache.get(sliced));
  else cache.set(slot === "key" ? sliced : "key", value);
  const used = collect();
  assert.ok(parent.length > 24 * 1024 * 1024 - 1);
  return used;
}
