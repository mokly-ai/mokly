import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { ownership, verifyInventory } from "./helpers/receiver/ownership.js";
import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";
import { observeBuild } from "./helpers/static_received.js";

test(
  "real publish sends gzip bodies only when they are smaller",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange({ gzip: true });
    let output: string | undefined;
    try {
      const result = await observeBuild(
        server,
        publish(root, server.endpoint, "rich", { signal: context.signal }),
      ).result;
      output = directory(result.stdout);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(server.completed, 1);
      const received = server.completedInventories[0]!;
      const entries = ownership(received.get(".mokly-export-artifact")!);
      verifyInventory([...received]);
      const blobEntries = entries.filter((entry) =>
        server.blobBodyLengths.has(entry.sha256),
      );
      const gzipEntries = blobEntries.filter(
        (entry) => server.blobEncodings.get(entry.sha256) === "gzip",
      );
      assert.ok(gzipEntries.length > 0);
      for (const entry of blobEntries) {
        const decoded = received.get(entry.path)!;
        const bodyLength = server.blobBodyLengths.get(entry.sha256);
        assert.ok(bodyLength !== undefined, entry.path);
        if (server.blobEncodings.get(entry.sha256) === "gzip") {
          assert.ok(bodyLength < decoded.length, entry.path);
        } else {
          assert.equal(bodyLength, decoded.length, entry.path);
        }
      }
    } finally {
      await cleanupAll([
        () => server.close(),
        async () => {
          if (output) await removeOutput(output);
        },
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);
