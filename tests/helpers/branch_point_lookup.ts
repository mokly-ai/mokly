import type { ManifestComponent } from "../../packages/viewer/src/components/manifest_types.js";
import type {
  ManifestEntry,
  ManifestScreen,
  ManifestV9,
} from "../../packages/viewer/src/registry/types.js";
import { createCatalogue } from "../../packages/viewer/src/shell/catalogue.js";
import type { RemovedEntrySnapshot } from "../../packages/viewer/src/shell/metadata.js";

import { currentManifest } from "./current_manifest.js";

function metadata(path: string) {
  return {
    path,
    title: path,
    sourcePath: "specs/entry.mockup.tsx",
    description: "Example",
    relatedDocs: [],
    declaredDependencies: [],
  };
}

export function lookupScreen(path: string, variantOf?: string): ManifestScreen {
  return {
    ...metadata(path),
    kind: "screen",
    colorSchemes: ["light"],
    useCasePaths: [],
    ...(variantOf === undefined ? {} : { variantOf }),
  };
}

export function lookupComponent(path: string): ManifestComponent {
  return {
    ...metadata(path),
    kind: "component",
    colorSchemes: ["light"],
    propSchema: { kind: "object", properties: {} },
    slots: [],
    controls: {},
    ownedDependencies: [],
  };
}

export function lookupCatalogue(
  entries: readonly ManifestEntry[],
  removed: readonly RemovedEntrySnapshot[] = [],
  moves: readonly { path: string; previousPath: string }[] = [],
) {
  const manifest: ManifestV9 = currentManifest({
    schemaVersion: 9,
    generatedBy: "mokly",
    entries,
    folders: [],
    sourceFiles: [],
  });
  return createCatalogue(manifest, removed, moves);
}
