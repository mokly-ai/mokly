/** Overlapping sibling tests must fail instead of sharing assertion credit. */
import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout } from "node:timers/promises";

test("concurrent parent", { concurrency: true }, async (context) => {
  await Promise.all([
    context.test("first sibling", async () => {
      await setTimeout(60);
      assert.equal(1, 1);
    }),
    context.test("second sibling", () => assert.equal(1, 1)),
  ]);
});
