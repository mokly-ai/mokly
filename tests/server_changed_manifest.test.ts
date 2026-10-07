import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestPaths } from "../dist/registry/changed_paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("changed routes select fragment edits rather than source or dependency edits", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  assert.deepEqual(
    changedManifestPaths(compilation.manifest, compilation.manifest, config, [
      "entries/fixture.mockup.tsx",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestPaths(compilation.manifest, compilation.manifest, config, [
      "notes.md",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestPaths(compilation.manifest, compilation.manifest, config, [
      "mockups/mokly-generated/home/index.mobile.html",
    ]),
    ["home", "tour"],
  );
  assert.deepEqual(
    changedManifestPaths(compilation.manifest, compilation.manifest, config, [
      "unrelated.txt",
    ]),
    [],
  );
});

test("manifest entry changes are attributed to their route", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const baseManifest = structuredClone(manifest);
  const baseHome = baseManifest.entries.find((entry) => entry.path === "home");
  if (!baseHome) throw new Error("fixture base home missing");
  baseHome.title = "Previous home";

  assert.deepEqual(
    changedManifestPaths(manifest, baseManifest, config, [
      "entries/fixture.mockup.tsx",
      "mockups/mokly-generated/mokly-manifest.json",
    ]),
    ["home", "tour"],
  );
});
