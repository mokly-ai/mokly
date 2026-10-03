import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { parseHistoricalManifest } from "../dist/registry/manifest.js";
import { readBaseManifest } from "../dist/review/base_manifest.js";
import { entryRoute, viewRoute } from "../packages/viewer/dist/data.js";

import { componentGit } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const version of [3, 4, 5, 6, 7]) {
  test(`historical manifest v${version} strips removed fields and collections`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const current = (await compileCatalogue(await loadConfig(fixture.root)))
      .manifest;
    const entries = current.entries.map((entry) => {
      const historical: Record<string, unknown> = {
        ...entry,
        dependencies: ["unused.ts"],
        declaredDependencies: ["unused.ts"],
        ownedDependencies: ["unused.ts"],
      };
      if (version < 7) {
        historical.route = entryRoute(entry.kind, entry.id);
        if (entry.kind === "screen") {
          delete historical.colorSchemes;
          historical.viewports = ["mobile", "desktop"];
          historical.fragments = {
            mobile: viewRoute("screen", entry.id, "mobile", "light"),
            desktop: viewRoute("screen", entry.id, "desktop", "light"),
          };
        }
      }
      return historical;
    });
    entries.push({
      id: "historical-folder",
      kind: "collection",
      title: "Historical folder",
      description: "Historical collection",
      navPath: [],
      sourcePath: "entries/fixture.mockup.tsx",
      relatedDocs: [],
      dependencies: [],
      childIds: [],
    });
    const historical = {
      generatedBy: "mokly",
      schemaVersion: version,
      entries,
      ...(version < 5
        ? { legacyPages: [] }
        : { sourceFiles: current.sourceFiles }),
    };
    const normalized = parseHistoricalManifest(historical);
    assert.equal(normalized.schemaVersion, 8);
    assert.deepEqual(normalized.entries, current.entries);
    assert.deepEqual(
      normalized.sourceFiles,
      version < 5 ? ["entries/fixture.mockup.tsx"] : current.sourceFiles,
    );
  });
}

test("historical normalization requires a numeric supported version", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const current = (await compileCatalogue(await loadConfig(fixture.root)))
    .manifest;
  for (const schemaVersion of ["7", 7.5, null])
    assert.throws(
      () => parseHistoricalManifest({ ...current, schemaVersion }),
      /schema version/,
    );
});

test("historical source inventory protects modules that only defined removed collections", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const { sourceFiles: _inventory, ...current } = (
    await compileCatalogue(await loadConfig(fixture.root))
  ).manifest;
  const collection = {
    id: "old-folder",
    kind: "collection",
    sourcePath: "mockups/retired-folder.tsx",
    childIds: [],
  };
  for (const schemaVersion of [3, 4]) {
    const historical = parseHistoricalManifest({
      ...current,
      schemaVersion,
      entries: [...current.entries, collection],
    });
    assert.ok(historical.sourceFiles.includes(collection.sourcePath));
    assert.ok(historical.entries.every(({ id }) => id !== collection.id));
  }
});

test("historical v5 to v7 still require their source inventory", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const { sourceFiles: _inventory, ...current } = (
    await compileCatalogue(await loadConfig(fixture.root))
  ).manifest;
  for (const schemaVersion of [5, 6, 7])
    assert.throws(
      () => parseHistoricalManifest({ ...current, schemaVersion }),
      /sourceFiles/,
    );
});

test("supported historical manifests remain readable through their earlier filenames", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const current = await compileCatalogue(config);
  for (const filename of ["mokabook-manifest.json", "mockbook-manifest.json"]) {
    const outputs = new Map(current.outputs);
    outputs.delete("mokly-manifest.json");
    outputs.set(
      filename,
      JSON.stringify({ ...current.manifest, schemaVersion: 7 }),
    );
    const repository = componentGit({ ...current, outputs }, []);
    assert.deepEqual(
      await readBaseManifest(repository.reader, "a".repeat(40), config),
      current.manifest,
    );
  }
});
