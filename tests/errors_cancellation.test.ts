import assert from "node:assert/strict";
import test from "node:test";

import { BaselineCommandError } from "../packages/mokly/dist/baseline/errors.js";
import {
  isCancellation,
  markCancellation,
  MoklyError,
} from "../packages/mokly/dist/errors.js";
import { withPreInstallationCancellation } from "../packages/mokly/dist/export/error.js";

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

test("an existing Mokly error is marked without replacing it", () => {
  const error = new MoklyError("build-invalid", "compile failed");
  const stack = error.stack;

  assert.equal(markCancellation(error), error);
  assert.equal(error.cancelled, true);
  assert.equal(error.stack, stack);
});

test("in-place cancellation keeps a baseline command's identity and fields", async () => {
  const controller = new AbortController();
  controller.abort();
  const cause = new Error("command failed");
  const original = new BaselineCommandError(
    2,
    ["npm", "run", "baseline"],
    17,
    null,
    ["first line", "last line"],
    cause,
  );
  const stack = original.stack;

  await assert.rejects(
    withPreInstallationCancellation(controller.signal, async () => {
      throw original;
    }),
    (classified: unknown) => {
      assert.equal(classified, original);
      assert.ok(classified instanceof BaselineCommandError);
      assert.equal(classified.commandIndex, 2);
      assert.deepEqual(classified.argv, ["npm", "run", "baseline"]);
      assert.equal(classified.exitCode, 17);
      assert.equal(classified.signal, null);
      assert.deepEqual(classified.outputLines, ["first line", "last line"]);
      assert.equal(classified.cause, cause);
      assert.equal(classified.stack, stack);
      assert.equal(isCancellation(classified), true);
      return true;
    },
  );
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
