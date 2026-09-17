import assert from "node:assert/strict";
import test from "node:test";

import { runCleanup } from "../src/viewer/cleanup.js";

test("cleanup releases every owner and preserves the original callback exception", () => {
  const original = new Error("Host callback failure");
  const released: number[] = [];
  const actions = Array.from({ length: 20_000 }, (_, index) => () => {
    released.push(index);
    if (index === 0) throw original;
    if (index === 1) throw new Error("Adapter disposal failure");
  });
  assert.throws(
    () => runCleanup(actions),
    (error) => error === original,
  );
  assert.equal(released.length, actions.length);
});

test("cleanup also preserves an undefined thrown value and supports an empty owner list", () => {
  let released = false,
    threw = false;
  try {
    runCleanup([
      () => {
        throw undefined;
      },
      () => {
        released = true;
      },
    ]);
  } catch (error) {
    threw = true;
    assert.equal(error, undefined);
  }
  assert.equal(threw, true);
  assert.equal(released, true);
  assert.doesNotThrow(() => runCleanup([]));
});
