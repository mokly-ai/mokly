/** Cleanup assertions must not give credit to an empty test body. */
import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";

afterEach(() => assert.equal(1, 1));
after(() => assert.equal(1, 1));
test("afterEach only", () => {});
test("context after only", (context) => {
  context.after(() => assert.equal(1, 1));
});
