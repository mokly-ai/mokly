import assert from "node:assert/strict";
import test from "node:test";

import { jsonText } from "../packages/mokly/src/sidecar/json.js";

import { legacyJsonText } from "./helpers/sidecar_legacy_json.js";

function generatedValues(): unknown[] {
  let seed = 0x5ca1ab1e;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  const keys = [
    "2",
    "10",
    "0",
    "02",
    "z",
    "a",
    "é",
    "中",
    "😀",
    "\ud800",
    "\udfff",
  ];
  const atoms = [
    null,
    undefined,
    true,
    false,
    -0,
    NaN,
    Infinity,
    -Infinity,
    42,
    '"\\\b\t\n\f\r\u0000 é中😀\ud800x\udfff',
    "long-中😀".repeat(4096),
  ];
  const make = (depth: number): unknown => {
    const choice = next();
    if (depth === 0 || choice % 3 === 0) return atoms[choice % atoms.length];
    if (choice % 3 === 1) {
      const values = new Array<unknown>(next() % 7);
      for (let index = 0; index < values.length; index++)
        if (next() % 3) values[index] = make(depth - 1);
      return values;
    }
    const value: Record<string, unknown> = {};
    for (let index = 0, count = next() % 8; index < count; index++)
      value[keys[next() % keys.length]!] = make(depth - 1);
    return value;
  };
  return [
    ...atoms.filter((value) => value !== undefined),
    ...Array.from({ length: 128 }, () => make(4)).filter(
      (value) => value !== undefined,
    ),
  ];
}

function mutationValue(trace: string[]) {
  const value: Record<string, unknown> = {
    get z() {
      trace.push("z");
      delete value.deleted;
      value.added = "too late";
      Object.defineProperty(value, "hidden", { enumerable: false });
      return {
        get nested() {
          trace.push("nested");
          return -0;
        },
      };
    },
    get a() {
      trace.push("a");
      value.replaced = "new";
      return undefined;
    },
    deleted: "gone",
    hidden: "hidden",
    replaced: "old",
  };
  return value;
}

test("sidecar JSON preserves the original encoder for generated and exotic values", () => {
  const iterator: unknown[] = ["ignored"];
  iterator[Symbol.iterator] = function* () {
    yield "iterator";
    yield undefined;
    yield "中";
    return undefined;
  };
  const callable = Object.assign(() => null, { z: -0, a: undefined });
  const inner = new Array<unknown>(2);
  inner[1] = -0;
  const nested = new Array<unknown>(3);
  nested[1] = undefined;
  nested[2] = inner;
  const sparse = new Array<unknown>(3);
  sparse[1] = nested;
  sparse[2] = undefined;
  const values = [
    ...generatedValues(),
    { "2": 2, "10": 10, "\udfff": true, "\ud800": false, "😀": [NaN, -0] },
    sparse,
    iterator,
    { toJSON: () => "ignored", value: -0 },
    new Date("2026-01-01T00:00:00Z"),
    Object("text"),
    Symbol("symbol"),
    123n,
    callable,
  ];
  for (const [index, value] of values.entries())
    assert.equal(jsonText(value), legacyJsonText(value), `value ${index}`);
  const expectedTrace: string[] = [];
  const actualTrace: string[] = [];
  const expected = legacyJsonText(mutationValue(expectedTrace));
  assert.equal(jsonText(mutationValue(actualTrace)), expected);
  assert.deepEqual(actualTrace, expectedTrace);
  assert.deepEqual(actualTrace, ["z", "a", "nested"]);
});
