import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestIds } from "../dist/registry/changed_ids.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("unchanged screens and flows stay out of Changes after dependency edits", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  assert.deepEqual(
    changedManifestIds(manifest, manifest, config, ["notes.md"]),
    [],
  );
});

test("shared source edits cannot turn the entire catalogue into Changes", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const { manifest } = await compileCatalogue(config);
  const shared = {
    ...config,
    review: { ...config.review, sharedImpact: ["src/**"] },
  };
  assert.deepEqual(
    changedManifestIds(manifest, manifest, shared, ["src/settings.tsx"]),
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
    entry.declaredDependencies = ["src/old-settings.tsx"];
  }
  assert.deepEqual(changedManifestIds(manifest, baseline, config, []), []);
});
