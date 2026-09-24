import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SelectedReviewSource } from "../src/review/selection_types.js";
import { PublicReviewAliases } from "../src/server/public_review.js";
import { ReviewGenerationStore } from "../src/server/review_generations.js";

test("complete alias captures do not renew unused generation retention", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-retention-"));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const source: SelectedReviewSource = {
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: [],
    headDigests: {},
    before: {
      schemaVersion: 6,
      generatedBy: "mokly",
      sourceFiles: [],
      entries: [],
    },
    after: {
      schemaVersion: 6,
      generatedBy: "mokly",
      sourceFiles: [],
      entries: [],
    },
  };
  const outDir = path.join(root, "current");
  let generation = 0;
  const store = new ReviewGenerationStore({
    outDir,
    async generate() {
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(
        path.join(outDir, ".mokly-review-artifact"),
        "schemaVersion=1\n",
      );
      await fs.writeFile(
        path.join(outDir, "review.json"),
        JSON.stringify({
          schemaVersion: 2,
          baseCommit: source.baseCommit,
          baseRef: source.baseRef,
          changedPaths: [`capture-${generation++}.txt`],
          ignoredImpact: [],
          screens: [],
          sharedImpact: [],
        }),
      );
    },
  });
  t.after(() => store.close());
  const aliases = new PublicReviewAliases(store);
  const capture = async () => {
    const result = await store.generate();
    assert.ok(await aliases.capture(result, source));
    return result;
  };
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const first = await capture();
  await capture();
  const archive = store.get(first.version)!.directory;
  for (let i = 0; i < 3; i++) {
    t.mock.timers.tick(20_000);
    await capture();
  }
  assert.equal(
    store.get(first.version),
    undefined,
    "unused generation expires at 60 seconds despite complete captures",
  );
  await store.close();
  await assert.rejects(fs.stat(archive), { code: "ENOENT" });
});

test("reading an archived generation renews its idle window", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-retention-"));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  const outDir = path.join(root, "current");
  const store = new ReviewGenerationStore({
    outDir,
    async generate() {
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(
        path.join(outDir, ".mokly-review-artifact"),
        "schemaVersion=1\n",
      );
    },
  });
  t.after(() => store.close());
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const first = await store.generate();
  await store.generate();
  t.mock.timers.tick(40_000);
  assert.ok(store.get(first.version));
  t.mock.timers.tick(40_000);
  assert.ok(store.get(first.version));
  t.mock.timers.tick(60_000);
  assert.equal(store.get(first.version), undefined);
});
