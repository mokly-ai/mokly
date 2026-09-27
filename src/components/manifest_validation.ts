import type {
  LegacyManifestComponentVariant,
  ManifestComponent,
} from "@mokly/viewer";
import {
  decodeProps,
  validateControlledValues,
  exactKeys,
  invalidData,
  validateProps,
  validateComponentViews,
} from "@mokly/viewer/data";

import { validateDependencyDeclarations } from "./dependency_validation.js";

/** Validate every per-view record against the complete registered component set. */
export function validateManifestComponentUsage(manifest: {
  entries: readonly Record<string, unknown>[];
  schemaVersion: number;
}): void {
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
      entry.kind === "component" && typeof entry.variantOf !== "string"
        ? [[entry.id as string, entry as unknown as ManifestComponent] as const]
        : [],
    ),
  );
  if (!components.size && version === 4)
    invalidData("$manifest", "v4 requires registered components");
  for (const entry of manifest.entries) {
    if (version === 7) validateDependencyDeclarations(entry as never);
    if (entry.kind === "screen") {
      if (components.size)
        validateComponentViews(
          entry.componentViews,
          version === 7
            ? (entry.colorSchemes as string[]).includes("dark")
            : entry.darkFragments !== undefined,
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
    if (entry.kind !== "component") continue;
    if (typeof entry.variantOf === "string") {
      const parent = components.get(entry.variantOf);
      if (!parent) continue;
      validateVariantAgainstParent(entry, parent);
      validateComponentViews(
        entry.componentViews,
        version === 7
          ? (entry.colorSchemes as string[]).includes("dark")
          : entry.darkFragments !== undefined,
        components,
        String(entry.id),
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
        typeof entry.id === "string" ? entry.id : undefined,
      );
  }
}

function validateVariantAgainstParent(
  variant: Record<string, unknown>,
  parent: ManifestComponent,
): void {
  const suppliedSlots = variant.suppliedSlots as string[];
  if (!suppliedSlots.every((slot) => parent.slots.includes(slot)))
    invalidData(variant.id as string, "unknown supplied slot");
  const data = validateProps(
    parent.propSchema,
    decodeProps(variant.props as never),
    variant.id as string,
  );
  validateControlledValues(parent.controls, data, variant.id as string);
}

export function componentFragmentPaths(
  entry: Record<string, unknown>,
): string[] {
  if (typeof entry.variantOf === "string")
    return [
      ...Object.values(entry.fragments as Record<string, string>),
      ...Object.values(
        (entry.darkFragments as Record<string, string> | undefined) ?? {},
      ),
    ];
  return (Array.isArray(entry.variants) ? entry.variants : []).flatMap(
    (variant: LegacyManifestComponentVariant) => [
      ...Object.values(variant.fragments),
      ...Object.values(variant.darkFragments ?? {}),
    ],
  );
}
