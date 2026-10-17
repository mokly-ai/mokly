import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import { upload } from "./helpers/receiver/upload.js";
import { git, write } from "./helpers/static_changes.js";
import { exchange } from "./helpers/static_exchange.js";
import {
  command,
  directory,
  publicationFixture,
  removeOutput,
} from "./helpers/static_publication.js";
import { verifyReceived } from "./helpers/static_received.js";

test(
  "publish with unavailable Changes uploads only current files and null comparison metadata",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    const server = await exchange();
    const outputs: string[] = [];
    try {
      await write(root, "historical.json", "{invalid");
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "invalid historical config");
      const base = await git(root, "rev-parse", "HEAD");
      await git(root, "branch", "broken-base");
      await write(root, "historical.json", '{"review":{"base":"broken-base"}}');
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "valid current config");
      for (const mode of ["rich", "plain"]) {
        const result = await command(
          root,
          "publish",
          [
            "--config=historical.json",
            "--strict",
            "--repository=example.com/team/site",
            `--endpoint=${server.endpoint}`,
            "--token=private/a==",
          ],
          mode,
        ).result;
        const output = directory(result.stdout);
        outputs.push(output);
        assert.equal(result.code, 0, result.stderr);
        assert.ok(result.stderr.includes(`base ${base}:`));
        assert.ok(!(result.stdout + result.stderr).includes("private/a=="));
        const received = server.completedInventories.at(-1)!;
        await verifyReceived(received, output);
        const metadata = upload(received.get("mokly-upload.json")!);
        for (const field of ["baseRef", "baseSha", "comparisonPath"])
          assert.equal(metadata[field], null);
        const index = readCatalogueIndex(
          JSON.parse(received.get("mokly-viewer/index.json")!.toString()),
        );
        assert.equal(index.changesStatus, "unavailable");
        assert.equal(index.base, "broken-base");
        assert.equal(index.comparisonUrl, null);
        assert.deepEqual(index.removedEntries, []);
        assert.ok(
          ![...received.keys()].some((name) =>
            name.startsWith("mokly-viewer/diffs/"),
          ),
        );
        assert.ok(
          index.screens.every(
            (entry) =>
              entry.changes.status === "unavailable" &&
              entry.views.every(
                (view) => view.comparison.status === "unavailable",
              ),
          ),
        );
        if (mode === "rich") {
          assert.match(
            result.stdout,
            /Changes unavailable · base validation failed/u,
          );
          assert.ok(
            result.stdout.indexOf("Changes unavailable") <
              result.stdout.indexOf("Preparing upload"),
          );
        } else
          assert.match(result.stdout, /already published for this commit/u);
      }
      assert.equal(server.completed, 2);
      assert.equal(server.completedInventories.length, 2);
    } finally {
      await server.close();
      for (const output of outputs) await removeOutput(output);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
