import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "@babel/parser";

import { ExportNameCache } from "../packages/mokly/src/sidecar/export-name-cache.js";
import { orderedExports } from "../packages/mokly/src/sidecar/export-order.js";

import { parserProbe } from "./helpers/export_cache.js";

const sources = ["export const a=1;", "export const b=1;", "export const c=1;"];

test("charged retention evicts the least recently used source at its exact cap", () => {
  const probe = parserProbe();
  const cache = new ExportNameCache(232, probe.parser);
  const read = (index: number) =>
    orderedExports(sources[index]!, { a: 1, b: 1, c: 1 }, "entry.ts", cache);
  read(0);
  assert.equal(cache.retainedBytes, 116);
  read(1);
  assert.equal(cache.retainedBytes, 232);
  read(0);
  read(2);
  read(0);
  assert.equal(probe.calls.length, 3);
  read(1);
  assert.deepEqual(
    probe.calls.map((call) => call.source),
    [sources[0], sources[1], sources[2], sources[1]],
  );
  assert.equal(cache.retainedBytes, 232);
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

test("recent live sources keep their parse results while dead versions fill the cap", () => {
  const probe = parserProbe();
  const cache = new ExportNameCache(464, probe.parser);
  for (const source of sources) orderedExports(source, {}, "entry.ts", cache);
  for (let version = 0; version < 25; version++) {
    orderedExports(`export let d=${version};`, {}, "entry.ts", cache);
    for (const source of sources) orderedExports(source, {}, "entry.ts", cache);
    assert.ok(cache.retainedBytes <= 464);
  }
  assert.deepEqual(
    probe.calls
      .filter((call) => sources.includes(call.source))
      .map((call) => call.source),
    sources,
  );
  assert.equal(probe.calls.length, 28);
});
