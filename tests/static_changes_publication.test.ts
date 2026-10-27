import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { verifyInventory } from "./helpers/receiver/ownership.js";
import { upload } from "./helpers/receiver/upload.js";
import { build, fixture } from "./helpers/static_changes.js";
import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import { files } from "./helpers/static_faults.js";
import {
  command,
  directory,
  removeOutput,
} from "./helpers/static_publication.js";
import { observeBuild } from "./helpers/static_received.js";

test(
  "publication includes the pinned comparison and an older receiver rejects it without fallback",
  { timeout: 120_000 },
  async (context) => {
    const { root, base } = await fixture();
    try {
      const local = await build(root, [], "rich", context.signal);
      const previous = await files(local.output);
      for (const status of [undefined, 426]) {
        const server = await exchange(
          status === undefined ? {} : { planStatus: status },
        );
        let output: string | undefined;
        try {
          const result = await observeBuild(
            server,
            command(
              root,
              "publish",
              [
                "--repository=example.com/team/site",
                `--endpoint=${server.endpoint}`,
                "--token=private/a==",
              ],
              status ? "plain" : "rich",
              {},
              context.signal,
            ),
          ).result;
          output = directory(result.stdout);
          assert.equal(result.code, status ? 1 : 0, result.stderr);
          assert.equal(server.bodies.length, 1);
          assert.equal(server.metadata[0]!.baseRef, "fixture-base");
          assert.equal(server.metadata[0]!.baseSha, base);
          const inventory = status
            ? new Map(
                [...(await files(output))].map(([name, bytes]) => [
                  name.replaceAll("\\", "/"),
                  bytes,
                ]),
              )
            : server.completedInventories[0]!;
          verifyInventory(
            [...inventory].map(([name, bytes]) => [
              name.replaceAll("\\", "/"),
              bytes,
            ]),
          );
          const envelope = upload(inventory.get("mokly-upload.json")!);
          assert.equal(envelope.baseSha, base);
          for (const [name, bytes] of previous) {
            if (name !== ".mokly-export-artifact")
              assert.deepEqual(
                inventory.get(name.replaceAll("\\", "/")),
                bytes,
                name,
              );
          }
          if (status) {
            assert.match(
              result.stderr,
              /\[mokly\/upload-unsupported-version\]/u,
            );
            assert.equal(server.completed, 0);
            assert.equal(server.attempts.size, 0);
          } else assert.equal(server.completed, 1);
        } finally {
          await cleanupAll([
            () => server.close(),
            async () => {
              if (output) await removeOutput(output);
            },
          ]);
        }
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
