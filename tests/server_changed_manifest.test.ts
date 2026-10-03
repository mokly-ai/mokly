import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { changedManifestIds } from "../dist/registry/changed_ids.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("changed routes select fragment edits rather than source or dependency edits", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "entries/fixture.mockup.tsx",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "notes.md",
    ]),
    [],
  );
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
      "mockups/mokly-generated/screens/home.mobile.html",
    ]),
    ["home", "tour"],
  );
  assert.deepEqual(
    changedManifestIds(compilation.manifest, compilation.manifest, config, [
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
  const baseHome = baseManifest.entries.find((entry) => entry.id === "home");
  if (!baseHome) throw new Error("fixture base home missing");
  baseHome.title = "Previous home";

  assert.deepEqual(
    changedManifestIds(manifest, baseManifest, config, [
      "entries/fixture.mockup.tsx",
      "mockups/mokly-generated/mokly-manifest.json",
    ]),
    ["home", "tour"],
  );
});
