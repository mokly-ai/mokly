import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { projectRealPath } from "../dist/config/paths.js";

import {
  asynchronousResults,
  operationScalingFailures,
} from "./helpers/operation_count_cases.js";
import {
  assertOperationScaling,
  countOperations,
} from "./helpers/operation_counts.js";

const file = fileURLToPath(import.meta.url);
const directory = import.meta.dirname;
const fsOperations = [
  {
    operation: "fs.statSync",
    call: (value: fs.PathLike) => fs.statSync(value),
  },
  {
    operation: "fs.lstatSync",
    call: (value: fs.PathLike) => fs.lstatSync(value),
  },
  {
    operation: "fs.existsSync",
    call: (value: fs.PathLike) => fs.existsSync(value),
  },
  {
    operation: "fs.readdirSync",
    call: (value: fs.PathLike) => fs.readdirSync(value),
  },
  {
    operation: "fs.realpathSync",
    call: (value: fs.PathLike) => fs.realpathSync(value),
  },
  {
    operation: "fs.realpathSync.native",
    call: (value: fs.PathLike) => fs.realpathSync.native(value),
  },
] as const;

function originals() {
  return {
    stat: fs.statSync,
    lstat: fs.lstatSync,
    exists: fs.existsSync,
    readdir: fs.readdirSync,
    realpath: fs.realpathSync,
    native: fs.realpathSync.native,
    relative: path.relative,
    resolve: path.resolve,
    sort: Array.prototype.sort,
  };
}

for (const { operation, call } of fsOperations) {
  test(`counts ${operation} through the default import and groups its first argument`, () => {
    const first = operation === "fs.readdirSync" ? directory : file;
    const url = pathToFileURL(first);
    const expected = call(first);
    const counted = countOperations(() => {
      call(first);
      call(Buffer.from(first));
      call(url);
      return call(first);
    });
    assert.deepEqual(counted.result, expected);
    assert.equal(counted.counts.totals[operation], 4);
    assert.deepEqual(
      counted.counts.byPath[operation],
      new Map([
        [first, 3],
        [String(url), 1],
      ]),
    );
  });
}

test("counts path calls by the first argument and preserves the sort receiver and comparator", () => {
  const values = [1, 3, 2];
  const counted = countOperations(() => ({
    relative: path.relative(directory, file),
    same: path.relative(directory, directory),
    resolved: path.resolve(directory, "child"),
    cwd: path.resolve(),
    sorted: values.sort((first, second) => second - first),
  }));
  assert.deepEqual(counted.result, {
    relative: path.basename(file),
    same: "",
    resolved: path.join(directory, "child"),
    cwd: process.cwd(),
    sorted: [3, 2, 1],
  });
  assert.equal(counted.result.sorted, values);
  assert.equal(counted.counts.totals["path.relative"], 2);
  assert.equal(counted.counts.totals["path.resolve"], 4);
  assert.equal(counted.counts.totals["Array.prototype.sort"], 1);
  assert.deepEqual(
    counted.counts.byPath["path.relative"],
    new Map([[directory, 2]]),
  );
  assert.deepEqual(
    counted.counts.byPath["path.resolve"],
    new Map([
      [directory, 2],
      [file, 1],
      ["undefined", 1],
    ]),
  );
  assert.ok(!("Array.prototype.sort" in counted.counts.byPath));
});

test("keeps native attached without changing the original realpath function", () => {
  const saved = originals();
  const counted = countOperations(() => {
    assert.notEqual(fs.realpathSync, saved.realpath);
    assert.notEqual(fs.realpathSync.native, saved.native);
    assert.equal(saved.realpath.native, saved.native);
    return fs.realpathSync.native(directory);
  });
  assert.equal(counted.result, saved.native(directory));
  assert.equal(counted.counts.totals["fs.realpathSync.native"], 1);
  assert.equal(counted.counts.totals["fs.realpathSync"], 0);
});

test("restores every original after returning and starts fresh counts on the next call", () => {
  const saved = originals();
  const result = {};
  const counted = countOperations(() => {
    const wrapped = originals();
    for (const key of Object.keys(saved) as (keyof typeof saved)[])
      assert.notEqual(wrapped[key], saved[key]);
    fs.existsSync(file);
    return result;
  });
  assert.equal(counted.result, result);
  assert.deepEqual(originals(), saved);
  const next = countOperations(() => undefined);
  assert.equal(next.result, undefined);
  for (const total of Object.values(next.counts.totals)) assert.equal(total, 0);
  for (const paths of Object.values(next.counts.byPath))
    assert.equal(paths.size, 0);
  assert.equal(counted.counts.totals["fs.existsSync"], 1);
});

test("restores every original and preserves a thrown failure", () => {
  const saved = originals();
  const failure = { message: "callback failed" };
  assert.throws(
    () =>
      countOperations(() => {
        throw failure;
      }),
    (error) => error === failure,
  );
  assert.deepEqual(originals(), saved);
  assert.equal(countOperations(() => fs.existsSync(file)).result, true);
});

for (const { name, create } of asynchronousResults) {
  test(`rejects a ${name} synchronously and restores every original without an unhandled rejection`, async () => {
    const saved = originals();
    assert.throws(
      () => countOperations(() => create()),
      /synchronous.*thenable|thenable.*synchronous/i,
    );
    assert.deepEqual(originals(), saved);
    await setImmediate();
    assert.equal(countOperations(() => fs.existsSync(file)).result, true);
  });
}

test("allows a result with a non-callable then property", () => {
  const result = { then: "data" };
  assert.equal(countOperations(() => result).result, result);
});

test("rejects nested use without replacing the outer wrappers", () => {
  const saved = originals();
  let nestedCalls = 0;
  const counted = countOperations(() => {
    const outer = originals();
    assert.throws(
      () =>
        countOperations(() => {
          nestedCalls += 1;
        }),
      /nested/i,
    );
    assert.deepEqual(originals(), outer);
    return fs.existsSync(file);
  });
  assert.equal(nestedCalls, 0);
  assert.equal(counted.result, true);
  assert.equal(counted.counts.totals["fs.existsSync"], 1);
  assert.deepEqual(originals(), saved);
  assert.throws(
    () => countOperations(() => countOperations(() => undefined)),
    /nested/i,
  );
  assert.deepEqual(originals(), saved);
  assert.equal(countOperations(() => fs.existsSync(file)).result, true);
});

test("intercepts the default imports used by compiled dist code", () => {
  const expected = projectRealPath(directory);
  const counted = countOperations(() => projectRealPath(directory));
  assert.equal(counted.result, expected);
  assert.equal(counted.counts.totals["fs.realpathSync.native"], 1);
  assert.equal(
    counted.counts.byPath["fs.realpathSync.native"].get(directory),
    1,
  );
  assert.equal(counted.counts.totals["fs.lstatSync"], 1);
  assert.equal(counted.counts.totals["path.resolve"], 1);
});

function measured(fixed: number, scaled: number) {
  return countOperations(() => {
    for (let index = 0; index < fixed; index++) path.resolve(directory);
    for (let index = 0; index < scaled; index++) fs.existsSync(file);
    return [2, 1].sort();
  });
}

for (const scaled of [7, 8, 9]) {
  test(`two-size assertions accept equal totals and path counts with scaled total ${scaled}`, () => {
    assertOperationScaling(
      measured(2, 2),
      measured(2, scaled),
      [
        { operation: "path.resolve" },
        { operation: "path.resolve", path: directory },
        { operation: "Array.prototype.sort" },
      ],
      ["fs.existsSync", "Array.prototype.sort"],
    );
  });
}

for (const failure of operationScalingFailures(directory)) {
  test(`two-size assertions reject a ${failure.name} and name the operation, path and both counts`, () => {
    const { operation, smaller, larger } = failure;
    const small = measured(
      failure.smallerInput.fixed,
      failure.smallerInput.scaled,
    );
    const large = measured(
      failure.largerInput.fixed,
      failure.largerInput.scaled,
    );
    assert.throws(
      () =>
        assertOperationScaling(
          small,
          large,
          failure.onceOnly,
          failure.scaledTotals,
        ),
      (error) =>
        error instanceof assert.AssertionError &&
        error.message.includes(operation) &&
        (failure.path === undefined || error.message.includes(failure.path)) &&
        error.message.includes(`smaller=${smaller}`) &&
        error.message.includes(`larger=${larger}`),
    );
  });
}
