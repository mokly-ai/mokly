import assert from "node:assert/strict";

import type { Compilation } from "../../dist/build/compile.js";
import type {
  ComponentViewRecord,
  ManifestComponent,
  ManifestComponentVariant,
} from "../../packages/viewer/dist/components/manifest_types.js";
import { isManifestComponentVariant } from "../../packages/viewer/dist/data.js";
import type { ManifestV8 } from "../../packages/viewer/dist/registry/types.js";

/** Every actual screen and saved-variant view, in its own entry scope. */
export function componentViews(manifest: ManifestV8): ComponentViewRecord[] {
  return manifest.entries.flatMap((entry) =>
    entry.kind === "screen"
      ? [...(entry.componentViews ?? [])]
      : entry.kind === "component" && isManifestComponentVariant(entry)
        ? [...entry.componentViews]
        : [],
  );
}

export function componentParent(
  manifest: ManifestV8,
  id: string,
): ManifestComponent {
  const entry = manifest.entries.find((candidate) => candidate.id === id);
  assert.ok(
    entry?.kind === "component" && !isManifestComponentVariant(entry),
    `Missing component ${id}`,
  );
  return entry;
}

export function componentVariants(
  manifest: ManifestV8,
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
