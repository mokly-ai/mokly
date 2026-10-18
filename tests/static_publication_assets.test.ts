import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import { git, write } from "./helpers/static_changes.js";
import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  command,
  directory,
  removeOutput,
} from "./helpers/static_publication.js";
import {
  comparisonPublication,
  currentBinary,
} from "./helpers/static_publication_changes.js";
import { verifyReceived } from "./helpers/static_received.js";

test(
  "ready publications upload CSS and binary deltas and reuse a comparison after an unrelated commit",
  { timeout: 120_000 },
  async (context) => {
    const { root, config } = await comparisonPublication();
    const server = await exchange();
    const outputs: string[] = [];
    const indices: ReturnType<typeof readCatalogueIndex>[] = [];
    const changedBinary = Buffer.from([0, 253, 130, 13, 10, 3]);
    try {
      for (const change of ["initial", "assets", "unrelated"]) {
        if (change === "assets") {
          await write(
            root,
            "tools/theme.css",
            '@import "./styles/child.css"; .hero{color:green}',
          );
          await fs.writeFile(
            path.join(root, "tools/styles/asset.png"),
            changedBinary,
          );
        } else if (change === "unrelated")
          await write(root, "unrelated.txt", "No rendered input changed");
        if (change !== "initial") {
          await git(root, "add", "-A");
          await git(root, "commit", "-qm", `publication ${change}`);
        }
        const attempts = new Map(server.attempts);
        const result = await command(
          root,
          "publish",
          [
            `--config=${config}`,
            "--base=requested-base",
            "--repository=example.com/team/site",
            `--endpoint=${server.endpoint}`,
            "--token=private/a==",
          ],
          "plain",
          {},
          context.signal,
        ).result;
        const output = directory(result.stdout);
        outputs.push(output);
        assert.equal(result.code, 0, result.stderr);
        assert.equal(result.stderr, "");
        const received = server.completedInventories.at(-1)!;
        await verifyReceived(received, output);
        const index = readCatalogueIndex(
          JSON.parse(received.get("mokly-viewer/index.json")!.toString()),
        );
        assert.equal(index.changesStatus, "ready");
        indices.push(index);
        const asset = [...received].find(
          ([name]) =>
            name.startsWith("static/mokly-generated/assets/") &&
            name.endsWith("/styles/asset.png"),
        );
        assert.ok(asset);
        assert.deepEqual(
          asset[1],
          change === "initial" ? currentBinary : changedBinary,
        );
        assert.ok(
          [...received.keys()].some(
            (name) =>
              name.startsWith("static/mokly-generated/") &&
              name.endsWith(".css"),
          ),
        );
        if (change === "assets") {
          assert.notEqual(index.deploymentId, indices[0]!.deploymentId);
          assert.notEqual(index.comparisonUrl, indices[0]!.comparisonUrl);
          assert.ok(server.missingCounts[1]! > 0);
          assert.ok(server.missingCounts[1]! < server.missingCounts[0]!);
        } else if (change === "unrelated") {
          assert.equal(index.deploymentId, indices[1]!.deploymentId);
          assert.equal(index.comparisonUrl, indices[1]!.comparisonUrl);
          assert.equal(server.missingCounts[2], 0);
          assert.deepEqual(server.attempts, attempts);
          const earlier = server.completedInventories[1]!;
          for (const [name, bytes] of received) {
            if (![".mokly-export-artifact", "mokly-upload.json"].includes(name))
              assert.deepEqual(bytes, earlier.get(name), name);
          }
        }
      }
      assert.equal(server.completed, 3);
    } finally {
      await cleanupAll([
        () => server.close(),
        ...outputs.map((output) => () => removeOutput(output)),
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);
