import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";
import { parseReviewResult } from "../packages/viewer/src/review/result_validation.js";

import { upload } from "./helpers/receiver/upload.js";
import { exchange } from "./helpers/static_exchange.js";
import { checkIdentity } from "./helpers/static_identity.js";
import {
  command,
  directory,
  removeOutput,
} from "./helpers/static_publication.js";
import {
  comparisonPublication,
  currentBinary,
  historicalBinary,
} from "./helpers/static_publication_changes.js";
import { verifyReceived } from "./helpers/static_received.js";

test(
  "publish delivers a ready generation with the pinned merge base and exact scoped binary bytes",
  { timeout: 120_000 },
  async () => {
    const { root, config, base, head, tip } = await comparisonPublication();
    const server = await exchange();
    let output: string | undefined;
    try {
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
        "rich",
      ).result;
      output = directory(result.stdout);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(server.completed, 1);
      assert.equal(server.completedInventories.length, 1);
      const received = server.completedInventories[0]!;
      await verifyReceived(received, output);
      const metadata = upload(received.get("mokly-upload.json")!);
      const index = readCatalogueIndex(
        JSON.parse(received.get("mokly-viewer/index.json")!.toString()),
      );
      assert.equal(index.changesStatus, "ready");
      assert.equal(index.base, "requested-base");
      assert.equal(metadata.baseRef, "requested-base");
      assert.equal(metadata.baseSha, base);
      assert.equal(metadata.headSha, head);
      assert.notEqual(metadata.baseSha, tip);
      assert.notEqual(metadata.baseSha, head);
      assert.equal(metadata.configPath, config);
      assert.equal(metadata.comparisonPath, index.comparisonUrl);
      assert.ok(index.comparisonUrl);
      const review = parseReviewResult(
        JSON.parse(received.get(index.comparisonUrl)!.toString()),
      );
      assert.equal(review.baseCommit, base);
      const generation = path.posix.dirname(index.comparisonUrl);
      assert.equal(received.has(`${generation}/snapshot.json`), false);
      assert.deepEqual(
        index.removedEntries.map(({ entry }) => entry.path),
        ["retired"],
      );
      assert.ok(received.has(`${generation}/entries/retired.json`));
      assert.ok(received.has("view/retired/index.html"));
      for (const [side, binary, colour, text] of [
        [
          "before",
          historicalBinary,
          /color:\s*(?:red|#f00)(?:[;}\s])/u,
          "Before",
        ],
        ["after", currentBinary, /color:\s*(?:blue|#00f)(?:[;}\s])/u, "After"],
      ] as const) {
        const prefix = `${generation}/snapshots/${side}/`;
        const asset = [...received].find(
          ([name]) =>
            name.startsWith(prefix) && name.endsWith("/styles/asset.png"),
        );
        assert.ok(asset);
        assert.deepEqual(asset[1], binary);
        assert.ok(
          [...received].some(
            ([name, bytes]) =>
              name.startsWith(prefix) &&
              name.endsWith(".css") &&
              colour.test(bytes.toString()),
          ),
        );
        assert.ok(
          received
            .get(`${prefix}mokly-generated/home/index.desktop.html`)!
            .toString()
            .includes(text),
        );
      }
      await checkIdentity(output, index.comparisonUrl, index.deploymentId);
      const phases = [
        "Loading configuration",
        "Rendering catalogue",
        "Comparing with requested-base",
        "Changes ready",
        "Writing static output",
        "Preparing upload",
        "Uploading catalogue",
        "Published Mokly catalogue",
      ];
      let previous = -1;
      for (const phase of phases) {
        const position = result.stdout.indexOf(phase);
        assert.ok(position > previous, result.stdout);
        previous = position;
      }
    } finally {
      await server.close();
      if (output) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
