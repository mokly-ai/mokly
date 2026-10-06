import assert from "node:assert/strict";
import test from "node:test";

import { PublishCancelledError } from "../packages/mokly/dist/publish/errors.js";
import {
  MAX_REQUEST_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  ReplanRequired,
  retryRequest,
  RetryableRequest,
} from "../packages/mokly/dist/publish/retry.js";

const transportFailure =
  "[mokly/upload-failed] The catalogue upload did not complete. Check the endpoint and connection, then retry.";

test("retry uses five attempts with exponential full jitter", async () => {
  let attempts = 0;
  const waits: number[] = [];
  await assert.rejects(
    retryRequest(
      {
        now: () => new Date("2026-09-26T12:00:00.000Z"),
        random: () => 0.5,
        sleep: async (milliseconds) => void waits.push(milliseconds),
      },
      async () => {
        attempts++;
        throw new RetryableRequest();
      },
    ),
    (error: unknown) => (error as Error).message === transportFailure,
  );
  assert.equal(attempts, MAX_REQUEST_ATTEMPTS);
  assert.deepEqual(
    waits,
    Array.from(
      { length: MAX_REQUEST_ATTEMPTS - 1 },
      (_, index) => RETRY_BASE_DELAY_MS * 0.5 * 2 ** index,
    ),
  );
});

test("Retry-After replaces jitter and expiry requests a re-plan", async () => {
  let attempts = 0;
  const waits: number[] = [];
  const now = new Date("2026-09-26T12:00:00.000Z");
  const value = await retryRequest(
    {
      now: () => now,
      random: () => 0.75,
      sleep: async (milliseconds) => void waits.push(milliseconds),
    },
    async () => {
      if (++attempts === 1) throw new RetryableRequest(2_000);
      return "stored";
    },
  );
  assert.equal(value, "stored");
  assert.deepEqual(waits, [2_000]);
  await assert.rejects(
    retryRequest(
      {
        now: () => now,
        random: () => 1,
        sleep: async () => assert.fail("expiry must prevent the wait"),
      },
      async () => {
        throw new RetryableRequest();
      },
      { expiresAt: "2026-09-26T12:00:01.000Z" },
    ),
    ReplanRequired,
  );
});

test("cancellation during retry sleep keeps its typed upload-failed copy", async () => {
  const controller = new AbortController();
  await assert.rejects(
    retryRequest(
      {
        now: () => new Date("2026-09-26T12:00:00.000Z"),
        random: () => 0.5,
        sleep: async (_milliseconds, signal) => {
          controller.abort();
          signal?.throwIfAborted();
        },
      },
      async () => {
        throw new RetryableRequest();
      },
      { signal: controller.signal },
    ),
    (error: unknown) => {
      assert.ok(error instanceof PublishCancelledError);
      assert.equal(
        error.message,
        "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.",
      );
      return true;
    },
  );
});
