/** Read component views and checked parents from current manifests. */
import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import type {
  ComponentViewRecord,
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import { isManifestComponentVariant } from "../../packages/viewer/dist/data.js";
import type { ManifestV9 } from "../../packages/viewer/dist/registry/types.js";

import { CatalogueSelectionError, entryAt } from "./catalogue_selection.js";

/** Every actual screen and saved-variant view, in its own entry scope. */
export function componentViews(manifest: ManifestV9): ComponentViewRecord[] {
  return manifest.entries.flatMap((entry) =>
    entry.kind === "screen"
      ? [...(entry.componentViews ?? [])]
      : entry.kind === "component" && isManifestComponentVariant(entry)
        ? [...entry.componentViews]
        : [],
  );
}

/** Find a component parent and reject a variant without making an assertion. */
export function componentParent(
  manifest: ManifestV9,
  id: string,
): ManifestComponent {
  const entry = entryAt(manifest, id, "component");
  if (isManifestComponentVariant(entry))
    throw new CatalogueSelectionError({
      helper: "componentParent",
      target: id,
      kind: "component",
      variants: "exclude",
      matches: 0,
      reason: "expected a component parent, found a variant",
    });
  return entry;
}

export function componentVariants(
  manifest: ManifestV9,
  parentId: string,
): ManifestComponentVariant[] {
  return manifest.entries.filter(
    (entry): entry is ManifestComponentVariant =>
      entry.kind === "component" &&
      isManifestComponentVariant(entry) &&
      entry.variantOf === parentId,
  );
}

export function screenView(compilation: Compilation): ComponentViewRecord {
  const screen = compilation.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen?.componentViews?.[0]);
  return screen.componentViews[0];
}
