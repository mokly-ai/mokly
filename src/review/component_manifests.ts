import type {
  LegacyManifestComponentVariant,
  ManifestComponentVariant,
} from "@mokly/viewer";
import {
  flattenComponentVariantEntries,
  isManifestComponentVariant,
  type Manifest,
} from "@mokly/viewer/data";

/** Present current and historical component variants through Review's grouped v3 shape. */
export function componentReviewManifest(manifest: Manifest): Manifest {
  const entries = flattenComponentVariantEntries(manifest.entries);
  const variantsByParent = new Map<string, ManifestComponentVariant[]>();
  for (const entry of entries) {
    if (entry.kind !== "component" || !isManifestComponentVariant(entry))
      continue;
    variantsByParent.set(entry.variantOf, [
      ...(variantsByParent.get(entry.variantOf) ?? []),
      entry,
    ]);
  }
  const grouped: typeof entries = [];
  for (const entry of entries) {
    if (entry.kind !== "component") {
      grouped.push(entry);
      continue;
    }
    if (isManifestComponentVariant(entry)) continue;
    grouped.push({
      ...entry,
      variants: (variantsByParent.get(entry.id) ?? []).map(nestedVariant),
    });
  }
  return {
    ...manifest,
    entries: grouped,
  } as Manifest;
}

function nestedVariant(
  entry: ManifestComponentVariant,
): LegacyManifestComponentVariant {
  return {
    id: entry.id,
    title: entry.title,
    ...(entry.description ? { description: entry.description } : {}),
    props: entry.props,
    suppliedSlots: entry.suppliedSlots,
    fragments: entry.fragments,
    ...(entry.darkFragments ? { darkFragments: entry.darkFragments } : {}),
    componentViews: entry.componentViews,
  };
}
