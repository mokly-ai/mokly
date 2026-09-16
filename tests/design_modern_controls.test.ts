import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ManifestV5 } from "../packages/viewer/dist/registry/types.js";

import { repositoryRoot } from "./helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/generated");
const manifest = JSON.parse(
  await fs.readFile(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV5;

function component(id: string) {
  const entry = manifest.entries.find((entry) => entry.id === id);
  if (entry?.kind !== "component") throw new Error(`Missing ${id}`);
  return entry;
}

test("the shared footer exposes only the icon panel and its current variants", () => {
  const footer = component("design-ui-inspector");
  assert.deepEqual(
    footer.variants.map((variant) => variant.id),
    ["details", "props", "closed"],
  );
  if (footer.propSchema.kind !== "object")
    throw new Error("Invalid footer schema");
  for (const key of ["presentation", "legacyBehavior", "legacyDestination"])
    assert.equal(Object.hasOwn(footer.propSchema.properties, key), false, key);
});

test("view options have one icon presentation and no separate top-bar scheme control", () => {
  const controls = component("design-ui-view-controls");
  const topBar = component("design-ui-top-bar");
  if (
    controls.propSchema.kind !== "object" ||
    topBar.propSchema.kind !== "object"
  )
    throw new Error("Invalid control schema");
  assert.equal(
    Object.hasOwn(controls.propSchema.properties, "presentation"),
    false,
  );
  assert.equal(Object.hasOwn(topBar.propSchema.properties, "scheme"), false);
  assert.equal(
    Object.hasOwn(topBar.propSchema.properties, "schemeDestinations"),
    false,
  );
});

test("every owning design and shared sample omits legacy footer and view markup", async () => {
  for (const entry of manifest.entries) {
    if (!entry.id.startsWith("design-")) continue;
    const views =
      entry.kind === "screen"
        ? [entry.fragments]
        : entry.kind === "component"
          ? entry.variants.map((variant) => variant.fragments)
          : [];
    for (const view of views)
      for (const file of Object.values(view)) {
        const html = await fs.readFile(path.join(generated, file), "utf8");
        assert.doesNotMatch(html, /class="mbk-details(?:-bar|-hint)?"/, file);
        assert.doesNotMatch(
          html,
          /role="group" aria-label="(?:Viewport|Color scheme)"/,
          file,
        );
      }
  }
});
