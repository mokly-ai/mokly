import assert from "node:assert/strict";
import test from "node:test";

import {
  browserFileArguments,
  selectBrowserShard,
} from "../scripts/verification/browser-partition.mjs";
import type { BrowserTestInventory } from "../scripts/verification/playwright.mjs";
import { validateBrowserShardBalance } from "../scripts/verification/shard-balance.mjs";

function inventory(counts: Record<string, number>): BrowserTestInventory {
  return {
    files: Object.keys(counts),
    tests: Object.entries(counts).flatMap(([specFile, count]) =>
      Array.from({ length: count }, (_, index) => ({
        id: `${specFile}:${index}`,
        project: "chromium",
        specFile,
        file: "shared_cases.ts",
        line: index + 1,
        column: 1,
        title: `${specFile} case ${index}`,
      })),
    ),
  };
}

test("weighted placement keeps whole specs and obeys the test-count cap", () => {
  const full = inventory({ a: 6, b: 6, c: 6, d: 6, e: 6, f: 6 });
  const weights = { a: 8, b: 7, c: 6, d: 5, e: 1, f: 1 };
  const parts = [1, 2, 3, 4].map((index) =>
    selectBrowserShard(full, { index, total: 4 }, weights),
  );
  assert.deepEqual(
    parts.map((part) => part.files),
    [["a"], ["b"], ["c", "f"], ["d", "e"]],
  );
  assert.deepEqual(
    parts
      .flatMap((part) => part.tests)
      .sort((a, b) => a.id.localeCompare(b.id)),
    full.tests,
  );
  validateBrowserShardBalance(
    parts.map((part, index) => ({
      assignedTests: part.tests,
      shard: { index: index + 1 },
    })),
    full.tests.length,
    4,
  );
});

test("count capacity takes priority over the least-cost partition", () => {
  const full = inventory({ a: 1, b: 1, c: 5, d: 5, e: 5, f: 5 });
  const weights = { a: 100, b: 90, c: 1, d: 1, e: 1, f: 1 };
  const parts = [1, 2, 3, 4].map((index) =>
    selectBrowserShard(full, { index, total: 4 }, weights),
  );
  assert.deepEqual(
    parts.map((part) => part.files),
    [["a", "f"], ["b", "e"], ["c"], ["d"]],
  );
});

test("discovery includes new files, excludes removed files and fixes tie order", () => {
  const full = inventory({ a: 1, b: 1, new: 1, other: 1 });
  const weights = { a: 2, b: 2, removed: 2 };
  const reversed = {
    files: [...full.files].reverse(),
    tests: [...full.tests].reverse(),
  };
  const parts = [1, 2].map((index) => {
    const shard = { index, total: 2 };
    const selected = selectBrowserShard(full, shard, weights);
    assert.deepEqual(selectBrowserShard(reversed, shard, weights), selected);
    return selected;
  });
  assert.deepEqual(
    parts.map((part) => part.files),
    [
      ["a", "new"],
      ["b", "other"],
    ],
  );
  assert.deepEqual(selectBrowserShard(full, { index: 1, total: 2 }, {}).files, [
    "a",
    "new",
  ]);
});

test("an oversized spec stays intact for the existing evidence rejection", () => {
  const full = inventory({ large: 8, small: 1, tiny: 1 });
  const parts = [1, 2].map((index) =>
    selectBrowserShard(full, { index, total: 2 }, {}),
  );
  assert.deepEqual(parts[0]?.files, ["large"]);
  assert.equal(parts.flatMap((part) => part.tests).length, full.tests.length);
  assert.throws(
    () =>
      validateBrowserShardBalance(
        parts.map((part, index) => ({
          assignedTests: part.tests,
          shard: { index: index + 1 },
        })),
        full.tests.length,
        2,
      ),
    /above the limit of 7/,
  );
  assert.throws(
    () => selectBrowserShard(full, { index: 4, total: 4 }, {}),
    /Playwright test discovery was empty/,
  );
});

test("file filters escape metacharacters and select only the exact spec", () => {
  const [pattern] = browserFileArguments(["tests/browser/a[1].spec.ts"]);
  const matches = new RegExp(pattern!);
  for (const file of [
    "/repo/tests/browser/a[1].spec.ts",
    "C:\\repo\\tests\\browser\\a[1].spec.ts",
    "tests/browser/a[1].spec.ts",
  ])
    assert.ok(matches.test(file), file);
  for (const file of [
    "/repo/tests/browser/a1.spec.ts",
    "/repo/other-tests/browser/a[1].spec.ts",
    "/repo/tests/browser/a[1].spec.ts.extra",
  ])
    assert.equal(matches.test(file), false, file);
});
