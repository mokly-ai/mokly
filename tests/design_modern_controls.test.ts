import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { ManifestComponentVariant } from "../packages/viewer/dist/components/manifest_types.js";
import {
  generatedViews,
  isManifestComponentVariant,
} from "../packages/viewer/dist/data.js";
import type {
  ManifestScreen,
  ManifestV9,
} from "../packages/viewer/dist/registry/types.js";

import { entriesWhere } from "./helpers/catalogue_selection.js";
import { componentParent } from "./helpers/component_views.js";
import { repositoryRoot } from "./helpers/fixture.js";

const generated = path.join(repositoryRoot, "examples/basic/mokly-generated");
const manifest = JSON.parse(
  await fs.readFile(path.join(generated, "mokly-manifest.json"), "utf8"),
) as ManifestV9;

test("the shared footer exposes only the icon panel and its current variants", () => {
  const footer = componentParent(
    manifest,
    "design/library/inspector/inspector",
  );
  assert.deepEqual(
    manifest.entries
      .filter(
        (entry) =>
          entry.kind === "component" &&
          isManifestComponentVariant(entry) &&
          entry.variantOf === footer.path,
      )
      .map((variant) => variant.path),
    [
      "design/library/inspector/inspector/details",
      "design/library/inspector/inspector/props",
      "design/library/inspector/inspector/closed",
    ],
  );
  if (footer.propSchema.kind !== "object")
    throw new Error("Invalid footer schema");
  for (const key of ["presentation", "legacyBehavior", "legacyDestination"])
    assert.equal(Object.hasOwn(footer.propSchema.properties, key), false, key);
});

test("view options have one icon presentation and no view-controls scheme control", () => {
  const controls = componentParent(
    manifest,
    "design/library/controls/view-controls",
  );
  const topBar = componentParent(manifest, "design/library/chrome/top-bar");
  if (
    controls.propSchema.kind !== "object" ||
    topBar.propSchema.kind !== "object"
  )
    throw new Error("Invalid control schema");
  for (const key of [
    "presentation",
    "scheme",
    "schemeDisabled",
    "schemeControl",
    "destinations",
  ])
    assert.equal(
      Object.hasOwn(controls.propSchema.properties, key),
      false,
      key,
    );
  assert.equal(
    Object.hasOwn(topBar.propSchema.properties, "appearance"),
    true,
    "the top bar owns the catalogue's one appearance setting",
  );
  assert.equal(
    Object.hasOwn(topBar.propSchema.properties, "schemeDestinations"),
    false,
  );
});

test("every owning design and shared sample omits legacy footer and view markup", async () => {
  const entries = entriesWhere(
    manifest,
    "screens and component variants under design/",
    (entry): entry is ManifestScreen | ManifestComponentVariant =>
      entry.path.startsWith("design/") &&
      (entry.kind === "screen" ||
        (entry.kind === "component" && isManifestComponentVariant(entry))),
  );
  for (const entry of entries) {
    for (const file of generatedViews(entry).map((view) => view.path)) {
      const html = await fs.readFile(path.join(generated, file), "utf8");
      assert.doesNotMatch(html, /class="mbk-details(?:-bar|-hint)?"/, file);
      assert.doesNotMatch(
        html,
        /role="group" aria-label="(?:Viewport|Preview color scheme)"/,
        file,
      );
    }
  }
});
