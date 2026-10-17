import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { exchange } from "./helpers/static_exchange.js";
import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";
import { verifyReceived } from "./helpers/static_received.js";

for (const replan of ["nonempty", "empty"] as const)
  test(
    `real publish re-plans ${replan} missing sets without rebuilding the installed bytes`,
    { timeout: 120_000 },
    async () => {
      const root = await publicationFixture();
      const server = await exchange({ replan });
      let output: string | undefined;
      try {
        const result = await publish(root, server.endpoint, "rich", {
          args: ["--upload-concurrency=1"],
        }).result;
        output = directory(result.stdout);
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stderr, "");
        assert.equal(server.bodies.length, 2);
        assert.deepEqual(server.bodies[0], server.bodies[1]);
        assert.equal(server.completionAttempts, 2);
        assert.equal(server.completed, 1);
        assert.equal(server.completedInventories.length, 1);
        await verifyReceived(server.completedInventories[0]!, output);
        const [first, second] = server.missingSets;
        assert.ok(first && first.length > 1);
        assert.deepEqual(second, replan === "nonempty" ? [first[0]] : []);
        for (const [hash, attempts] of server.attempts)
          assert.equal(
            attempts,
            replan === "nonempty" && hash === first[0] ? 2 : 1,
          );
        assert.equal(server.maximumBlobConcurrency, 1);
        for (const phase of [
          "Rendering catalogue…",
          "Preparing upload…",
          "Uploading catalogue…",
          "Published Mokly catalogue",
        ])
          assert.equal(result.stdout.split(phase).length - 1, 1, result.stdout);
      } finally {
        await server.close();
        if (output) await removeOutput(output);
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );
