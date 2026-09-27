import { entryRoute } from "../data/routes.js";
import type { ManifestEntry } from "../registry/types.js";

import type {
  LegacyManifestComponentVariant,
  ManifestComponent,
  ManifestComponentVariant,
} from "./manifest_types.js";

/** Expand one pre-v7 local saved id into the component's global id namespace. */
export function legacyComponentVariantId(
  componentId: string,
  variantId: string,
): string {
  return variantId.startsWith(`${componentId}-`)
    ? variantId
    : `${componentId}-${variantId}`;
}

/** Adapt one historical nested saved variant to the current entry shape. */
export function legacyComponentVariantEntry(
  parent: ManifestComponent,
  variant: LegacyManifestComponentVariant,
): ManifestComponentVariant {
  const id = legacyComponentVariantId(parent.id, variant.id);
  return {
    declaredDependencies: [...(parent.declaredDependencies ?? [])],
    dependencies: [...parent.dependencies],
    description: variant.description ?? parent.description,
    id,
    kind: "component",
    navPath: [...parent.navPath],
    relatedDocs: [...parent.relatedDocs],
    route: entryRoute("component", id),
    sourcePath: parent.sourcePath,
    title: variant.title,
    variantOf: parent.id,
    viewports: ["mobile", "desktop"],
    ...(parent.rationale ? { rationale: parent.rationale } : {}),
    ...(parent.tags ? { tags: [...parent.tags] } : {}),
    props: variant.props,
    suppliedSlots: [...variant.suppliedSlots],
    fragments: { ...variant.fragments },
    ...(variant.darkFragments
      ? { darkFragments: { ...variant.darkFragments } }
      : {}),
    componentViews: [...variant.componentViews],
  };
}

/** Expand historical nested variants and remove their legacy parent field. */
export function flattenComponentVariantEntries(
  entries: readonly ManifestEntry[],
): ManifestEntry[] {
  const flattened: ManifestEntry[] = [];
  for (const entry of entries) {
    if (entry.kind !== "component" || "variantOf" in entry) {
      flattened.push(entry);
      continue;
    }
    if (!("variants" in entry)) {
      flattened.push(entry);
      continue;
    }
    const { variants, ...parent } = entry;
    flattened.push(parent as ManifestComponent);
    for (const variant of variants)
      flattened.push(legacyComponentVariantEntry(entry, variant));
  }
  return flattened;
}
