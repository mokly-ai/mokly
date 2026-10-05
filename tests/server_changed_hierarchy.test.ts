import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestPaths } from "../dist/registry/changed_paths.js";
import type { ManifestV8 } from "../packages/viewer/dist/registry/types.js";

import {
  createFixture,
  removeFixture,
  reparentedEntrySource,
} from "./helpers/fixture.js";

test("changing a path marks its screen and referencing use case", async (context) => {
  const fixture = await createFixture(reparentedEntrySource("screens"));
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseManifest = await compileManifest(config);
  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("archive"),
  );
  const manifest = await compileManifest(config);

  assert.deepEqual(changedManifestPaths(manifest, baseManifest, config, []), [
    "fixture/archive/home",
    "fixture/archive/tour",
  ]);
});

test("changing a folder label changes presentation without changing entry metadata", async (context) => {
  const fixture = await createFixture(reparentedEntrySource("screens"));
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseManifest = await compileManifest(config);
  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("screens", { screensTitle: "Product screens" }),
  );
  const manifest = await compileManifest(config);

  assert.deepEqual(
    changedManifestPaths(manifest, baseManifest, config, []),
    [],
  );
});

async function compileManifest(
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<ManifestV8> {
  return (await compileCatalogue(config)).manifest;
}
