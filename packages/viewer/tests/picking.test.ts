import assert from "node:assert/strict";
import { test } from "node:test";

import { viewerFailures } from "../src/viewer/failures.js";
import { Picking } from "../src/viewer/picking.js";
import type { ViewerError } from "../src/viewer/types.js";

test("idle cancellation does not clear a separately requested highlight", () => {
  let cleared = 0;
  const picking = new Picking(
    () => ({}),
    () => true,
    () => {
      cleared++;
    },
    (error) => error as Error,
  );
  picking.end({ reason: "cancelled" });
  picking.end({ reason: "cancelled" });
  assert.equal(cleared, 0);
});

test("a failed mount and its pending pick report the same failure once", async () => {
  const errors: ViewerError[] = [];
  const report = viewerFailures(
    () => ({ onError: (error) => errors.push(error) }),
    () => true,
  );
  const picking = new Picking(
    () => ({}),
    () => true,
    () => {},
    (error) => report(error, "frame"),
  );
  let rejectActivation!: (error: Error) => void;
  const pending = picking.start(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectActivation = reject;
      }),
  );
  const cause = new Error("Mount failed");
  picking.end({ reason: "error" }, cause);
  const failure = report(cause, "frame");
  rejectActivation(failure);
  await assert.rejects(pending, (error) => error === failure);
  assert.equal(errors.length, 1);
  assert.equal(picking.active, false);
});
