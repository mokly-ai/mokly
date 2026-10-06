import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertOperationScaling,
  countOperations,
} from "./helpers/operation_counts.js";
import type { OnceOnlyOperation } from "./helpers/operation_counts.js";

const directory = import.meta.dirname;
const otherPath = fileURLToPath(import.meta.url);
const onceOnly: readonly OnceOnlyOperation[] = [
  { operation: "realpath", path: directory },
];

function measured(standard: number, native: number, other = 0) {
  return countOperations(() => {
    for (let index = 0; index < standard; index++) fs.realpathSync(directory);
    for (let index = 0; index < native; index++)
      fs.realpathSync.native(directory);
    for (let index = 0; index < other; index++) {
      fs.realpathSync(otherPath);
      fs.realpathSync.native(otherPath);
    }
    return directory;
  });
}

for (const [standard, native] of [
  [0, 4],
  [1, 3],
  [4, 0],
] as const) {
  test(`combined realpath counts accept equal sums when ${standard} standard and ${native} native calls trade places`, () => {
    const smaller = measured(standard, native, 1);
    const larger = measured(native, standard, 4);
    assert.equal(smaller.result, directory);
    assert.equal(larger.result, directory);
    assert.equal(
      smaller.counts.byPath["fs.realpathSync"].get(directory) ?? 0,
      standard,
    );
    assert.equal(
      smaller.counts.byPath["fs.realpathSync.native"].get(directory) ?? 0,
      native,
    );
    assertOperationScaling(smaller, larger, onceOnly, []);
  });
}

for (const { name, standard, native } of [
  { name: "fs.realpathSync", standard: 2, native: 1 },
  { name: "fs.realpathSync.native", standard: 1, native: 2 },
]) {
  test(`combined realpath counts reject growth in ${name} and name the path and both sums`, () => {
    assert.throws(
      () =>
        assertOperationScaling(
          measured(1, 1),
          measured(standard, native),
          onceOnly,
          [],
        ),
      (error) =>
        error instanceof assert.AssertionError &&
        error.message.includes(
          `realpath [${directory}]: smaller=2, larger=3`,
        ) &&
        error.message.includes("once-only counts must be equal"),
    );
  });
}

for (const [standard, native] of [
  [0, 0],
  [1, 0],
  [0, 1],
] as const) {
  test(`combined realpath counts reject a zero smaller sum before ${standard} standard and ${native} native calls`, () => {
    assert.throws(
      () =>
        assertOperationScaling(
          measured(0, 0, 1),
          measured(standard, native, 4),
          onceOnly,
          [],
        ),
      (error) =>
        error instanceof assert.AssertionError &&
        error.message.includes(
          `realpath [${directory}]: smaller=0, larger=${standard + native}`,
        ) &&
        error.message.includes("the smaller count must be greater than zero"),
    );
  });
}
