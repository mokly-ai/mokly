import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readEntryDetail } from "../packages/viewer/src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../packages/viewer/src/catalogue/index_reader.js";

import { write, git } from "./helpers/static_changes.js";
import { cleanupAll } from "./helpers/static_cleanup.js";
import { exchange } from "./helpers/static_exchange.js";
import { files } from "./helpers/static_faults.js";
import {
  command,
  directory,
  publicationFixture,
  publish,
  removeOutput,
} from "./helpers/static_publication.js";

async function build(root: string, output: string) {
  const result = await command(root, "build", [
    "--base=fixture-base",
    `--out=${output}`,
  ]).result;
  assert.equal(result.code, 0, result.stderr);
  return files(path.join(root, output));
}

test(
  "a changed screen gets a new detail id while an unchanged screen keeps its bytes",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture();
    try {
      await write(
        root,
        "specs/second.screen.html",
        "---\ntitle: Second\n---\n<h1>Second</h1>",
      );
      await git(root, "add", ".");
      await git(root, "commit", "-qm", "add second screen");
      await git(root, "branch", "fixture-base");
      const first = await build(root, ".context/site-first");
      await write(
        root,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Edited</h1>",
      );
      await git(root, "add", ".");
      await git(root, "commit", "-qm", "edit first screen");
      const second = await build(root, ".context/site-second");
      const firstIndex = readCatalogueIndex(
        JSON.parse(first.get("mokly-viewer/index.json")!.toString()),
      );
      const secondIndex = readCatalogueIndex(
        JSON.parse(second.get("mokly-viewer/index.json")!.toString()),
      );
      const detailPath = (entry: string) =>
        `mokly-viewer/entries/${entry}.json`;
      assert.deepEqual(
        first.get(detailPath("second")),
        second.get(detailPath("second")),
      );
      assert.notDeepEqual(
        first.get(detailPath("home")),
        second.get(detailPath("home")),
      );
      for (const [index, output] of [
        [firstIndex, first],
        [secondIndex, second],
      ] as const) {
        for (const entry of ["home", "second"]) {
          const detail = readEntryDetail(
            JSON.parse(output.get(detailPath(entry))!.toString()),
          );
          const record = index.screens.find(
            (candidate) => candidate.path === entry,
          )!;
          assert.equal(detail.detailId, record.detailId);
        }
      }
    } finally {
      await cleanupAll([() => fs.rm(root, { recursive: true, force: true })]);
    }
  },
);

test(
  "a second publication does not request an unchanged detail blob",
  { timeout: 120_000 },
  async (context) => {
    const root = await publicationFixture();
    const server = await exchange();
    const outputs: string[] = [];
    try {
      await write(
        root,
        "specs/second.screen.html",
        "---\ntitle: Second\n---\n<h1>Second</h1>",
      );
      await git(root, "add", ".");
      await git(root, "commit", "-qm", "add second screen");
      let result = await publish(root, server.endpoint, "plain", {
        signal: context.signal,
      }).result;
      assert.equal(result.code, 0, result.stderr);
      outputs.push(directory(result.stdout));
      await write(
        root,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Edited</h1>",
      );
      await git(root, "add", ".");
      await git(root, "commit", "-qm", "edit first screen");
      result = await publish(root, server.endpoint, "plain", {
        signal: context.signal,
      }).result;
      assert.equal(result.code, 0, result.stderr);
      outputs.push(directory(result.stdout));
      const unchanged = server.completedInventories[0]!.get(
        "mokly-viewer/entries/second.json",
      )!;
      const hash = crypto.createHash("sha256").update(unchanged).digest("hex");
      assert.ok(!server.missingSets[1]!.includes(hash));
      assert.equal(server.completed, 2);
    } finally {
      await cleanupAll([
        () => server.close(),
        ...outputs.map((output) => () => removeOutput(output)),
        () => fs.rm(root, { recursive: true, force: true }),
      ]);
    }
  },
);
