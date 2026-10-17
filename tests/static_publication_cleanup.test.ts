import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

test("publication cleanup attempts every step and retains each failure", async () => {
  const receiver = new Error("receiver failed");
  const output = new Error("output removal failed");
  const steps: string[] = [];
  await assert.rejects(
    cleanupAll([
      async () => {
        steps.push("receiver");
        throw receiver;
      },
      async () => {
        steps.push("output");
        throw output;
      },
      async () => {
        steps.push("fixture");
      },
    ]),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, [receiver, output]);
      return true;
    },
  );
  assert.deepEqual(steps, ["receiver", "output", "fixture"]);
});

test(
  "aborting the test signal stops a publication waiting for Plan",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    let onPlan!: () => void;
    const planned = new Promise<void>((resolve) => {
      onPlan = resolve;
    });
    const server = await exchange({ holdPlan: onPlan });
    const controller = new AbortController();
    const running = publish(root, server.endpoint, "plain", {
      signal: AbortSignal.any([context.signal, controller.signal]),
    });
    let output: string | undefined;
    try {
      await planned;
      controller.abort();
      const result = await running.result;
      output = directory(result.stdout);
      assert.notEqual(result.code, 0);
      assert.ok(
        running.child.exitCode !== null || running.child.signalCode !== null,
      );
      assert.equal(server.completed, 0);
    } finally {
      controller.abort();
      await cleanupAll([
        () => server.close(),
        async () => {
          const result = await running.result;
          await removeOutput(output ?? directory(result.stdout));
        },
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);
