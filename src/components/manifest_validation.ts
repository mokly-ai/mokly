import type {
  LegacyManifestComponentVariant,
  HistoricalManifestComponent,
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";
import type { Manifest } from "@mokly/viewer/data";
import {
  decodeProps,
  validateControlledValues,
  exactKeys,
  invalidData,
  isManifestComponentVariant,
  validateProps,
  validateComponentViews,
} from "@mokly/viewer/data";

import { validateDependencyDeclarations } from "./dependency_validation.js";

/** Validate every per-view record against the complete registered component set. */
export function validateManifestComponentUsage(manifest: Manifest): void {
  const version = manifest.schemaVersion;
  if (
    version !== 5 &&
    version !== 6 &&
    version !== 7 &&
    (version !== 4 || "sourceFiles" in manifest)
  )
    return;
  exactKeys(
    manifest,
    [
      "schemaVersion",
      "generatedBy",
      "entries",
      [5, 6, 7].includes(version) ? "sourceFiles" : "legacyPages",
    ],
    "$manifest",
  );
  const components = new Map<string, ManifestComponent>(
    manifest.entries.flatMap((entry) =>
      entry.kind === "component" && !isManifestComponentVariant(entry)
        ? [[entry.id, entry] as const]
        : [],
    ),
  );
  if (!components.size && version === 4)
    invalidData("$manifest", "v4 requires registered components");
  for (const entry of manifest.entries) {
    validateDependencyDeclarations(entry);
    if (entry.kind === "screen") {
      if (components.size)
        validateComponentViews(
          entry.componentViews,
          entry.darkFragments !== undefined,
          components,
          entry.id,
        );
      else if (entry.componentViews !== undefined)
        invalidData(entry.id, "component usage requires registered components");
      continue;
    }
    if (entry.kind !== "component") continue;
    if (isManifestComponentVariant(entry)) {
      const parent = components.get(entry.variantOf);
      if (!parent) continue;
      validateVariantAgainstParent(entry, parent);
      validateComponentViews(
        entry.componentViews,
        entry.darkFragments !== undefined,
        components,
        entry.id,
        parent.id,
      );
      continue;
    }
    const legacyVariants =
      "variants" in entry && Array.isArray(entry.variants)
        ? (entry.variants as LegacyManifestComponentVariant[])
        : [];
    for (const legacy of legacyVariants)
      validateComponentViews(
        legacy.componentViews,
        legacy.darkFragments !== undefined,
        components,
        `${entry.id} / ${legacy.id}`,
        entry.id,
      );
  }
}

function validateVariantAgainstParent(
  variant: ManifestComponentVariant,
  parent: ManifestComponent,
): void {
  if (!variant.suppliedSlots.every((slot) => parent.slots.includes(slot)))
    invalidData(variant.id, "unknown supplied slot");
  const data = validateProps(
    parent.propSchema,
    decodeProps(variant.props),
    variant.id,
  );
  validateControlledValues(parent.controls, data, variant.id);
}

export function componentFragmentPaths(
  entry: Record<string, unknown>,
): string[] {
  const component = entry as unknown as
    ManifestComponent | HistoricalManifestComponent | ManifestComponentVariant;
  if (isManifestComponentVariant(component))
    return [
      ...Object.values(component.fragments),
      ...Object.values(component.darkFragments ?? {}),
    ];
  return ("variants" in component ? component.variants : []).flatMap(
    (variant: LegacyManifestComponentVariant) => [
      ...Object.values(variant.fragments),
      ...Object.values(variant.darkFragments ?? {}),
    ],
  );
}
