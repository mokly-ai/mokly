import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestRoutes } from "../dist/registry/changed_routes.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("unchanged screens and flows stay out of Changes after dependency edits", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  assert.deepEqual(
    changedManifestRoutes(manifest, manifest, config, ["notes.md"]),
    [],
  );
});

test("shared source edits cannot turn the entire catalogue into Changes", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  assert.deepEqual(
    changedManifestRoutes(manifest, manifest, config, ["src/settings.tsx"]),
    [],
  );
});

test("dependency declarations and source moves alone do not need screen review", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  const baseline = structuredClone(manifest);
  for (const entry of baseline.entries) {
    entry.sourcePath = "entries/old.mockup.tsx";
    entry.dependencies = [entry.sourcePath, "src/old-settings.tsx"];
  }
  assert.deepEqual(changedManifestRoutes(manifest, baseline, config, []), []);
});
