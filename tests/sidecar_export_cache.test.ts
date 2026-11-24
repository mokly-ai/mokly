import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "@babel/parser";

import { ExportNameCache } from "../packages/mokly/src/sidecar/export-name-cache.js";
import { orderedExports } from "../packages/mokly/src/sidecar/export-order.js";

import { parserProbe } from "./helpers/export_cache.js";

const sources = ["export const a=1;", "export const b=1;", "export const c=1;"];

test("charged retention evicts the least recently used source at its exact cap", () => {
  // Charges: 64 per entry, 2 per source code unit, 16 + 2 per name code unit.
  const lru = ["export const a=10;", "export const b=1;", "export const c=1"];
  const probe = parserProbe();
  const cache = new ExportNameCache(234, probe.parser);
  const read = (index: number) =>
    orderedExports(lru[index]!, { a: 1, b: 1, c: 1 }, "entry.ts", cache);
  read(0);
  assert.equal(cache.retainedBytes, 118);
  read(1);
  assert.equal(cache.retainedBytes, 234);
  read(0);
  read(2);
  assert.equal(cache.retainedBytes, 232);
  read(0);
  assert.equal(probe.calls.length, 3);
  read(1);
  assert.deepEqual(
    probe.calls.map((call) => call.source),
    [lru[0], lru[1], lru[2], lru[1]],
  );
  assert.equal(cache.retainedBytes, 234);
});

test("retention charges UTF-16 sources and names and stays bounded across versions", () => {
  const cache = new ExportNameCache(400);
  orderedExports("export const a=1;//😀", { a: 1 }, "entry.ts", cache);
  assert.equal(cache.retainedBytes, 124);
  for (let version = 0; version < 50; version++) {
    const value = `export const value=${version};`;
    assert.deepEqual(
      orderedExports(value, { value: version }, "entry.ts", cache),
      [["value", version]],
    );
    assert.ok(cache.retainedBytes > 0);
    assert.ok(cache.retainedBytes <= 400);
  }
});

test("oversized sources and second mode lists return results without retention", () => {
  const probe = parserProbe();
  const cache = new ExportNameCache(116, probe.parser);
  const source = sources[0]!;
  for (const module of ["a.ts", "a.tsx", "a.ts", "a.tsx"])
    assert.deepEqual(orderedExports(source, { a: 1 }, module, cache), [
      ["a", 1],
    ]);
  assert.equal(probe.calls.length, 3);
  assert.equal(cache.retainedBytes, 116);
  const oversized = source + " // too large";
  for (let call = 0; call < 2; call++)
    assert.deepEqual(orderedExports(oversized, { a: 2 }, "a.ts", cache), [
      ["a", 2],
    ]);
  assert.equal(probe.calls.length, 5);
  orderedExports(source, { a: 3 }, "a.ts", cache);
  assert.equal(probe.calls.length, 5);
  assert.equal(cache.retainedBytes, 116);
});

test("failed parses retain and evict nothing and preserve the same error", () => {
  const failure = new SyntaxError("broken parse");
  const calls: string[] = [];
  const parser: typeof parse = (source, options) => {
    calls.push(source);
    if (source === "broken") throw failure;
    return parse(source, options);
  };
  const cache = new ExportNameCache(232, parser);
  for (const source of sources.slice(0, 2))
    orderedExports(source, {}, "entry.ts", cache);
  for (let call = 0; call < 2; call++)
    assert.throws(
      () => orderedExports("broken", {}, "entry.ts", cache),
      (error) => error === failure,
    );
  assert.equal(cache.retainedBytes, 232);
  for (const source of sources.slice(0, 2))
    orderedExports(source, {}, "entry.ts", cache);
  assert.deepEqual(calls, [sources[0], sources[1], "broken", "broken"]);
});
