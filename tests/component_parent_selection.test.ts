/** Preserve checked component-parent lookup and variant rejection. */
import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestComponent } from "../packages/viewer/dist/components/manifest_types.js";

import { CatalogueSelectionError } from "./helpers/catalogue_selection.js";
import {
  componentVariant,
  manifest,
  parent,
} from "./helpers/catalogue_selection_fixture.js";
import { componentParent } from "./helpers/component_views.js";

function selectionError(action: () => unknown, ...details: string[]): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof CatalogueSelectionError);
    assert.equal(error.name, "CatalogueSelectionError");
    for (const detail of details)
      assert.ok(error.message.includes(detail), error.message);
    return true;
  });
}

test("componentParent keeps original parents and rejects component variants", () => {
  const found: ManifestComponent = componentParent(manifest, parent.path);
  assert.equal(found, parent);
  selectionError(
    () => componentParent(manifest, componentVariant.path),
    "componentParent",
    componentVariant.path,
    "kind=component",
    "variants=exclude",
    "matches=0",
  );
});
