import assert from "node:assert/strict";
import test from "node:test";

import { isCancellation, MoklyError } from "../dist/errors.js";

test("cancellation classification uses only explicit marks and AbortError", () => {
  const marked = new MoklyError("export-invalid", "cancelled", {
    cancelled: true,
  });
  const unmarked = new MoklyError("export-invalid", "not cancelled");
  const abort = new Error("aborted");
  abort.name = "AbortError";
  const domAbort = new DOMException("aborted", "AbortError");

  assert.equal(isCancellation(marked), true);
  assert.equal(isCancellation(unmarked), false);
  assert.equal(isCancellation(abort), true);
  assert.equal(isCancellation(domAbort), true);
  assert.equal(marked.cancelled, true);
  assert.equal(unmarked.cancelled, false);
});

test("cancellation classification never traverses causes, aggregates or text", () => {
  const cancellation = new MoklyError("export-invalid", "cancelled", {
    cancelled: true,
  });
  const wrapped = new MoklyError("export-invalid", "combined failure", {
    cause: cancellation,
  });
  const aggregate = new AggregateError([cancellation], "combined failure");
  const timeout = new DOMException("timed out", "TimeoutError");

  assert.equal(isCancellation(wrapped), false);
  assert.equal(isCancellation(aggregate), false);
  assert.equal(isCancellation(timeout), false);
  assert.equal(isCancellation(new Error("AbortError: cancelled")), false);
  assert.equal(isCancellation({ name: "AbortError" }), false);
});
