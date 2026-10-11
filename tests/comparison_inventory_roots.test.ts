import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { GitReviewAssetReader } from "../dist/review/assets.js";
import { baselineResourceConfig } from "../dist/review/base_manifest.js";
import { compareReview } from "../dist/review/compare.js";
import { CompiledReviewAssetReader } from "../dist/review/head_assets.js";
import { importedChangedPaths } from "../dist/review/imported_changes.js";

import { changedFixture } from "./helpers/changed_fixture.js";
import { committedReviewRepository } from "./helpers/committed_repository.js";

test("a catalogue-root move excludes both generated trees without dropping authored evidence", async (t) => {
  const fixture = await changedFixture(
    t,
    undefined,
    {
      extraConfig: 'stylesheets: [{match:"**", stylesheets:["theme.css"]}],',
    },
    async ({ mockupsDir }) => {
      await fs.writeFile(
        path.join(mockupsDir, "theme.css"),
        "main{color:purple}",
      );
    },
  );
  const before = fixture.compilation;
  const repository = committedReviewRepository(fixture.config);
  const commit = await repository.evidence.mergeBase("HEAD", "HEAD");
  await fs.rename(fixture.mockupsDir, path.join(fixture.root, "current"));
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      'mockupsDir: "mockups"',
      'mockupsDir: "current"',
    ),
  );
  await fs.appendFile(
    path.join(fixture.root, "notes.md"),
    "\nUnrendered authored edit.\n",
  );
  const config = await loadConfig(fixture.root);
  const after = await compileCatalogue(config);
  await writeCompilation(after, config);
  const beforeReader = new GitReviewAssetReader(
    baselineResourceConfig(config, before.manifest),
    repository.reader,
    commit,
    "current",
    before.manifest,
  );
  const changed = await repository.evidence.changedPaths(commit);
  assert.ok(
    changed.some((file) => file.startsWith("mockups/mokly-generated/")),
  );
  assert.ok(
    changed.some((file) => file.startsWith("current/mokly-generated/")),
  );
  const evidence = await importedChangedPaths(
    config,
    beforeReader,
    new CompiledReviewAssetReader(config, after.outputs),
    changed,
    after.outputs,
    after.deliveredStyleSources,
  );
  assert.ok(evidence.includes("notes.md"));
  assert.ok(evidence.includes("mokly.config.ts"));
  assert.ok(
    evidence.every(
      (file) =>
        !file.startsWith("mockups/mokly-generated/") &&
        !file.startsWith("current/mokly-generated/"),
    ),
    JSON.stringify(evidence),
  );
  const result = await compareReview(after, config, repository, "HEAD");
  assert.deepEqual(result.result.changes, []);
});
