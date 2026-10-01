import assert from "node:assert/strict";
import test from "node:test";

import { detachParseError } from "../src/review/css/cache_error.js";
import { CssRuleParseError } from "../src/review/css/types.js";

test("stackless snapshots preserve explicit error data and restore the stack limit", () => {
  const limit = Error.stackTraceLimit;
  const cause = new TypeError("nested");
  const original = new CssRuleParseError(cause);
  const snapshot = detachParseError(original);
  assert.ok(snapshot);
  assert.deepEqual(snapshot.error, original);
  assert.equal(snapshot.error.stack, original.stack);
  assert.equal((snapshot.error.cause as Error).stack, cause.stack);
  assert.equal(Error.stackTraceLimit, limit);
  assert.equal(
    detachParseError(new CssRuleParseError({ opaque: () => undefined })),
    undefined,
  );
  assert.equal(Error.stackTraceLimit, limit);
});
