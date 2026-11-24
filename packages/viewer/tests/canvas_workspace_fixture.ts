/** The workspace of one routed path of the fixture catalogue, for canvas tests. */

import assert from "node:assert/strict";

import type { CatalogueReadModel } from "@mokly/model";

import type { ShellCatalogueRoutedEntry } from "../src/catalogue/scoped_types.js";
import { createCatalogue } from "../src/shell/catalogue.js";
import { publicWorkspace } from "../src/shell/public_workspace.js";

import { indexFixture, shellModelFixture } from "./catalogue_v9_fixture.js";

/** Give each screen and component of the index a dark render of each view. */
function withDarkViews(index: CatalogueReadModel): void {
  for (const entry of [...index.screens, ...index.components]) {
    entry.colorSchemes = ["light", "dark"];
    entry.views = entry.views.flatMap((view) => [
      view,
      { ...view, colorScheme: "dark" as const },
    ]);
  }
}

/**
 * The workspace of one routed screen or component of the fixture catalogue;
 * `dark` gives every view a dark render.
 */
export function workspace(path: string, dark: boolean) {
  const model = shellModelFixture(
    indexFixture(dark ? withDarkViews : undefined),
  );
  const catalogue = createCatalogue(model);
  const entry = catalogue.byPath.get(path) as ShellCatalogueRoutedEntry;
  assert.ok(entry.kind === "screen" || entry.kind === "component", path);
  return publicWorkspace(catalogue, model, entry);
}
