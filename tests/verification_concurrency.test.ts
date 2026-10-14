import assert from "node:assert/strict";
import test from "node:test";

import {
  UNIT_CONCURRENCY_VARIABLE,
  unitTestConcurrency,
} from "../scripts/verification/concurrency.mjs";

test("Node file concurrency uses half the CPUs with a floor of two", () => {
  for (const [cpus, expected] of [
    [1, 2],
    [2, 2],
    [4, 2],
    [8, 4],
  ])
    assert.equal(unitTestConcurrency({}, cpus), expected);
});

test("Node file concurrency accepts only safe positive integer overrides", () => {
  assert.equal(unitTestConcurrency({ [UNIT_CONCURRENCY_VARIABLE]: "3" }, 1), 3);
  for (const value of ["", "0", "-1", "1.5", " 2", "two", "9007199254740992"])
    assert.throws(
      () => unitTestConcurrency({ [UNIT_CONCURRENCY_VARIABLE]: value }, 8),
      /positive integer/,
    );
});
