import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import type {
  ComponentViewRecord,
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import {
  flattenComponentVariantEntries,
  isManifestComponentVariant,
} from "../../packages/viewer/dist/data.js";
import type { Manifest } from "../../packages/viewer/dist/registry/types.js";

/** Every actual screen and saved-variant view, in its own entry scope. */
export function componentViews(manifest: Manifest): ComponentViewRecord[] {
  return manifest.entries.flatMap((entry) =>
    entry.kind === "screen"
      ? [...(entry.componentViews ?? [])]
      : entry.kind === "component" && isManifestComponentVariant(entry)
        ? [...entry.componentViews]
        : [],
  );
}

export function componentParent(
  manifest: Manifest,
  id: string,
): ManifestComponent {
  const entry = flattenComponentVariantEntries(manifest.entries).find(
    (candidate) => candidate.id === id,
  );
  assert.ok(
    entry?.kind === "component" && !isManifestComponentVariant(entry),
    `Missing component ${id}`,
  );
  return entry;
}

export function componentVariants(
  manifest: Manifest,
  parentId: string,
): ManifestComponentVariant[] {
  return flattenComponentVariantEntries(manifest.entries).filter(
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
