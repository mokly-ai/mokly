import assert from "node:assert/strict";
import test from "node:test";

import { ExportNameCache } from "../packages/mokly/src/sidecar/export-name-cache.js";
import { orderedExports } from "../packages/mokly/src/sidecar/export-order.js";

import { parserProbe } from "./helpers/export_cache.js";

test("export order preserves AST declarations and current namespace fallback", () => {
  const source = `export const zed = 1;
export default function() {}
const local = 2;
export { local as "display-name" };
export * from "./star";
export type OnlyType = string;
export const { destructured } = { destructured: 3 };
export function named() {}
export interface Shared {}
export const Shared = 4;`;
  const values = {
    extra: 9,
    Shared: 4,
    named: 8,
    destructured: 3,
    "display-name": 2,
    default: 7,
    zed: 1,
  };
  const expected = [
    ["zed", 1],
    ["default", 7],
    ["display-name", 2],
    ["named", 8],
    ["Shared", 4],
    ["Shared", 4],
    ["extra", 9],
    ["destructured", 3],
  ];
  const cached = new ExportNameCache();
  const uncached = new ExportNameCache(0);
  for (const module of ["entry.ts", "entry.tsx"])
    for (let call = 0; call < 2; call++) {
      assert.deepEqual(
        orderedExports(source, values, module, cached),
        expected,
      );
      assert.deepEqual(
        orderedExports(source, values, module, uncached),
        expected,
      );
    }
});

test("cache reuses exact text and parser mode and misses changed text", () => {
  const probe = parserProbe();
  const cache = new ExportNameCache(undefined, probe.parser);
  const source = "export const a = 1;";
  for (const module of ["a.ts", "b.mts", "c.cts", "d.tsx", "e.jsx", "f.mjs"])
    assert.deepEqual(orderedExports(source, { a: 1 }, module, cache), [
      ["a", 1],
    ]);
  assert.equal(probe.calls.length, 2);
  assert.deepEqual(
    probe.calls.map((call) => call.plugins),
    [["typescript"], ["typescript", "jsx"]],
  );
  assert.equal(cache.retainedBytes, 138);
  assert.deepEqual(orderedExports(source + "\n", { a: 2 }, "a.ts", cache), [
    ["a", 2],
  ]);
  assert.equal(probe.calls.length, 3);
  assert.equal(cache.retainedBytes, 260);
});

test("cached AST names cannot retain runtime fallback names or caller mutations", () => {
  const probe = parserProbe();
  const cache = new ExportNameCache(undefined, probe.parser);
  const source = "export const declared = 1;";
  const value = {};
  const first = orderedExports(
    source,
    { z: 1, declared: value },
    "entry.ts",
    cache,
  );
  assert.deepEqual(first, [
    ["declared", value],
    ["z", 1],
  ]);
  first[0]![0] = "mutated";
  first.push(["injected", {}]);
  const next = { y: 2, z: 3, declared: value };
  Object.setPrototypeOf(next, { inherited: 4 });
  assert.deepEqual(orderedExports(source, next, "entry.ts", cache), [
    ["declared", value],
    ["y", 2],
    ["z", 3],
  ]);
  assert.deepEqual(orderedExports(source, { y: 5 }, "entry.ts", cache), [
    ["y", 5],
  ]);
  assert.equal(probe.calls.length, 1);
});

test("JSX stays accepted only in the existing JSX parser mode", () => {
  const cache = new ExportNameCache();
  const source = "export default <main />;";
  assert.deepEqual(orderedExports(source, { default: 1 }, "entry.tsx", cache), [
    ["default", 1],
  ]);
  for (let call = 0; call < 2; call++)
    assert.throws(
      () => orderedExports(source, {}, "entry.ts", cache),
      SyntaxError,
    );
  assert.deepEqual(orderedExports(source, { default: 2 }, "entry.jsx", cache), [
    ["default", 2],
  ]);
});
