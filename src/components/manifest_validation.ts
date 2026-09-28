import type { ManifestComponent } from "@mokly/viewer";
import {
  exactKeys,
  invalidData,
  validateComponentViews,
} from "@mokly/viewer/data";

import { validateDependencyDeclarations } from "./dependency_validation.js";
import { validateVariantAgainstParent } from "./manifest_entry_validation.js";

/** Validate every v7 per-view record against the complete component set. */
export function validateManifestComponentUsage(manifest: {
  entries: readonly Record<string, unknown>[];
  schemaVersion: number;
}): void {
  if (manifest.schemaVersion !== 7) return;
  exactKeys(
    manifest,
    ["schemaVersion", "generatedBy", "entries", "sourceFiles"],
    "$manifest",
  );
  const components = new Map<string, ManifestComponent>(
    manifest.entries.flatMap((entry) =>
      entry.kind === "component" && typeof entry.variantOf !== "string"
        ? [[entry.id as string, entry as unknown as ManifestComponent] as const]
        : [],
    ),
  );
  for (const entry of manifest.entries) {
    validateDependencyDeclarations(entry as never);
    if (entry.kind === "screen") {
      if (components.size)
        validateComponentViews(
          entry.componentViews,
          (entry.colorSchemes as string[]).includes("dark"),
          components,
          String(entry.id),
        );
      else if (entry.componentViews !== undefined)
        invalidData(
          String(entry.id),
          "component usage requires registered components",
        );
      continue;
    }
    if (entry.kind !== "component" || typeof entry.variantOf !== "string")
      continue;
    const parent = components.get(entry.variantOf);
    if (!parent) continue;
    validateVariantAgainstParent(entry, parent);
    validateComponentViews(
      entry.componentViews,
      (entry.colorSchemes as string[]).includes("dark"),
      components,
      String(entry.id),
      parent.id,
    );
  }
}
