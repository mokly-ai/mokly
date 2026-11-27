import assert from "node:assert/strict";
import test from "node:test";

import { selectViewerShard } from "../scripts/verification/viewer-partition.mjs";

const FILES = ["a.test.ts", "b.test.ts", "c.test.ts", "d.test.ts", "e.test.ts"];

test("viewer shards hold whole files by measured duration in discovery order", () => {
  const weights = {
    "a.test.ts": 10,
    "b.test.ts": 60,
    "c.test.ts": 30,
    "d.test.ts": 20,
    "e.test.ts": 40,
  };
  const parts = [1, 2].map((index) =>
    selectViewerShard(FILES, { index, total: 2 }, weights),
  );
  assert.deepEqual(parts, [
    ["b.test.ts", "d.test.ts"],
    ["a.test.ts", "c.test.ts", "e.test.ts"],
  ]);
});

test("an unmeasured viewer file uses the median measured duration", () => {
  const weights = { "a.test.ts": 1, "b.test.ts": 50, "c.test.ts": 100 };
  const files = ["a.test.ts", "b.test.ts", "c.test.ts", "new.test.ts"];
  const parts = [1, 2].map((index) =>
    selectViewerShard(files, { index, total: 2 }, weights),
  );
  assert.deepEqual(parts, [
    ["a.test.ts", "c.test.ts"],
    ["b.test.ts", "new.test.ts"],
  ]);
});

test("a viewer shard without files is empty", () => {
  assert.deepEqual(
    selectViewerShard(["a.test.ts"], { index: 2, total: 2 }, {}),
    [],
  );
});
