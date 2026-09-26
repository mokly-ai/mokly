import assert from "node:assert/strict";
import test from "node:test";

import {
  ReplanRequired,
  retryRequest,
  RetryableRequest,
} from "../dist/publish/retry.js";

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
    /upload-failed/,
  );
  assert.equal(attempts, 5);
  assert.deepEqual(waits, [500, 1_000, 2_000, 4_000]);
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

test("cancellation during retry sleep is upload-failed", async () => {
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
    /upload-failed/,
  );
});
