import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestRoutes } from "../dist/registry/changed_routes.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import type { ManifestV6 } from "../packages/viewer/dist/registry/types.js";

import {
  createFixture,
  removeFixture,
  reparentedEntrySource,
} from "./helpers/fixture.js";

test("changing a navPath marks its screen and referencing use case", async (context) => {
  const fixture = await createFixture(reparentedEntrySource("screens"));
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseManifest = await compileManifest(config);
  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("archive"),
  );
  const manifest = await compileManifest(config);

  assert.deepEqual(changedManifestRoutes(manifest, baseManifest, config, []), [
    "screens/home.html",
    "user-flows/tour.html",
  ]);
});

test("changing a folder label marks its routed descendants", async (context) => {
  const fixture = await createFixture(reparentedEntrySource("screens"));
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const baseManifest = await compileManifest(config);
  await fs.promises.writeFile(
    fixture.entryPath,
    reparentedEntrySource("screens", { screensTitle: "Product screens" }),
  );
  const manifest = await compileManifest(config);

  assert.deepEqual(changedManifestRoutes(manifest, baseManifest, config, []), [
    "screens/details.html",
    "screens/home.html",
    "user-flows/tour.html",
  ]);
});

test("a validated v5 baseline with collections does not invent moves in unchanged v6 entries", async (context) => {
  const fixture = await createFixture(reparentedEntrySource("screens"));
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const current = await compileManifest(config);
  const historical = parseHistoricalManifest({
    ...current,
    schemaVersion: 5,
    entries: [
      ...current.entries,
      {
        id: "fixture",
        kind: "collection",
        title: "Fixture",
        description: "Former navigation folder",
        childIds: current.entries
          .filter(
            ({ navPath }) => navPath[0] === "Fixture" && navPath.length === 1,
          )
          .map(({ id }) => id),
        navPath: [],
        dependencies: [],
        declaredDependencies: [],
        relatedDocs: [],
        sourcePath: current.entries[0]!.sourcePath,
      },
    ],
  });
  assert.equal(historical.schemaVersion, 5);
  assert.equal(historical.entries.length, current.entries.length);
  assert.deepEqual(changedManifestRoutes(current, historical, config, []), []);
});

async function compileManifest(
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<ManifestV6> {
  return (await compileCatalogue(config)).manifest;
}
