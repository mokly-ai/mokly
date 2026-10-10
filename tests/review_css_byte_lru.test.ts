import assert from "node:assert/strict";
import test from "node:test";

import {
  ByteBoundedLru,
  CSS_CACHE_BYTES,
  flatString,
} from "../src/review/css/byte_lru.js";

const detach = (value: string) => ({
  value: flatString(value),
  ruleCount: 0,
  stringUnits: value.length,
});
const cost = (key: string, value: string) =>
  64 + 2 * (key.length + value.length);

test("the default cache bound is exactly 64 MiB", () => {
  assert.equal(CSS_CACHE_BYTES, 67_108_864);
  const cache = new ByteBoundedLru(detach);
  cache.set("key", "value");
  assert.equal(cache.estimatedBytes, cost("key", "value"));
});

test("entry accounting charges each rule and repeated UTF-16 string slot", () => {
  const cache = new ByteBoundedLru(() => ({
    value: "detached",
    ruleCount: 3,
    stringUnits: 12 + 12 + "\uD800😀".length,
  }));
  cache.set("key", "input");
  assert.equal(cache.estimatedBytes, 64 + 96 * 3 + 2 * (3 + 12 + 12 + 3));
});

test("insertion evicts oldest entries repeatedly until the new value fits", () => {
  const cache = new ByteBoundedLru(detach, 204);
  for (const key of ["a", "b", "c"]) cache.set(key, "x");
  assert.equal(cache.size, 3);
  cache.set("d", "x".repeat(34));
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("c"), "x");
  assert.equal(cache.get("d"), "x".repeat(34));
  assert.equal(cache.estimatedBytes, 202);
});

test("a hit refreshes recency but a miss does not", () => {
  const cache = new ByteBoundedLru(detach, 136);
  cache.set("a", "x");
  cache.set("b", "x");
  assert.equal(cache.get("a"), "x");
  assert.equal(cache.get("missing"), undefined);
  cache.set("c", "x");
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), "x");
  assert.equal(cache.get("c"), "x");
});

test("replacement accounts only the new entry and makes it most recent", () => {
  const cache = new ByteBoundedLru(detach, 140);
  cache.set("a", "x");
  cache.set("b", "x");
  cache.set("a", "xxx");
  assert.equal(cache.estimatedBytes, 140);
  assert.equal(cache.size, 2);
  cache.set("c", "x");
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), "xxx");
  assert.equal(cache.estimatedBytes, 140);
});

test("oversize requests return their value without evicting useful entries", () => {
  const cache = new ByteBoundedLru(detach, 68);
  cache.set("a", "x");
  assert.equal(cache.set("large", "oversized"), "oversized");
  assert.equal(cache.set("a", "oversized"), "oversized");
  assert.equal(cache.get("large"), undefined);
  assert.equal(cache.get("a"), "x");
  assert.equal(cache.estimatedBytes, 68);
});

test("zero bound neither retains values nor builds detached entries", () => {
  const cache = new ByteBoundedLru(() => {
    assert.fail("a zero bound cannot build a detached entry");
  }, 0);
  assert.equal(cache.set("key", "value"), "value");
  assert.equal(cache.get("key"), undefined);
  assert.equal(cache.size, 0);
  assert.equal(cache.estimatedBytes, 0);
});

test("flat copies preserve every code unit, including unpaired surrogates", () => {
  const text = "nul\0😀\uD800end\uDC00";
  assert.equal(flatString(text), text);
});
