import assert from "node:assert/strict";
import test from "node:test";

import { startWatchedServe } from "./watched_serve.js";

test("watched serve startup failures include captured stderr", async () => {
  await assert.rejects(
    startWatchedServe('throw new Error("stderr-specific startup failure");'),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /serve exited early/);
      assert.match(error.message, /stdout:/);
      assert.match(
        error.message,
        /stderr:[\s\S]*stderr-specific startup failure/,
      );
      return true;
    },
  );
});

test("watched serve drains a large stderr stream before shutdown", async () => {
  await assert.rejects(
    startWatchedServe(
      'console.error("x".repeat(131072)); throw new Error("stderr tail marker");',
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /serve exited early/);
      assert.match(error.message, /stderr:[\s\S]*stderr tail marker/);
      assert.ok(error.message.length < 34_000);
      return true;
    },
  );
});
