import assert from "node:assert/strict";
import { test } from "node:test";

import {
  measuredSeconds,
  parseAppShard,
  parseShardWeights,
  selectShardFiles,
} from "./browser-shards";

const files = [
  "src/_tests_/a.spec.ts",
  "src/_tests_/b.spec.ts",
  "src/_tests_/c.spec.ts",
  "src/_tests_/new.spec.ts",
];
/** `removed.spec.ts` no longer exists; the median of 1, 5, 6, 10 is 6. */
const weights = {
  "src/_tests_/a.spec.ts": 10,
  "src/_tests_/b.spec.ts": 6,
  "src/_tests_/c.spec.ts": 5,
  "src/_tests_/removed.spec.ts": 1,
};

test("shards balance measured seconds and give an unmeasured file the median", () => {
  // a (10) and b (6) open the shards; new (6) joins b at 12; c (5) joins a at 15.
  assert.deepEqual(selectShardFiles(files, weights, { current: 1, total: 2 }), [
    "src/_tests_/a.spec.ts",
    "src/_tests_/c.spec.ts",
  ]);
  assert.deepEqual(selectShardFiles(files, weights, { current: 2, total: 2 }), [
    "src/_tests_/b.spec.ts",
    "src/_tests_/new.spec.ts",
  ]);
});

test("every discovered file runs on exactly one shard", () => {
  for (const total of [1, 3, 5]) {
    const placed = Array.from({ length: total }, (_, index) =>
      selectShardFiles(files, weights, { current: index + 1, total }),
    ).flat();
    assert.deepEqual(placed.sort(), files, `${total} shards`);
  }
});

test("MKC_APP_SHARD selects one shard, and an empty value selects none", () => {
  assert.deepEqual(parseAppShard("2/8"), { current: 2, total: 8 });
  assert.equal(parseAppShard(""), undefined);
  assert.equal(parseAppShard(undefined), undefined);
  for (const value of ["0/4", "5/4", "2/4x", "2"])
    assert.throws(() => parseAppShard(value), /MKC_APP_SHARD must be/, value);
});

test("weights accept only seconds per file", () => {
  assert.deepEqual(parseShardWeights({ "src/_tests_/a.spec.ts": 1.5 }), {
    "src/_tests_/a.spec.ts": 1.5,
  });
  for (const value of [[], null, { "src/_tests_/a.spec.ts": -1 }, { a: "1" }])
    assert.throws(() => parseShardWeights(value), /browser-shard-weights/);
});

test("list reporter lines, coloured or plain, give seconds per spec file", () => {
  const log = [
    "2026-11-24T23:38:32Z   ✓    1 [desktop] › src/_tests_/a.spec.ts:93:5 › signs in (1.9s)",
    "2026-11-24T23:38:33Z   ✓    2 [desktop] › src/_tests_/a.spec.ts:122:5 › refuses (978ms)",
    "2026-11-24T23:38:35Z   ✘    3 [mobile] › src/_tests_/b-mobile.spec.ts:4:7 › waits \u001b[2m(1.5m)\u001b[22m",
    "2026-11-24T23:38:36Z Running 113 tests using 1 worker",
  ].join("\n");
  const seconds = measuredSeconds(log);
  assert.deepEqual(Object.keys(seconds), [
    "src/_tests_/a.spec.ts",
    "src/_tests_/b-mobile.spec.ts",
  ]);
  assert.ok(Math.abs(seconds["src/_tests_/a.spec.ts"] - 2.878) < 1e-9);
  assert.equal(seconds["src/_tests_/b-mobile.spec.ts"], 90);
});
