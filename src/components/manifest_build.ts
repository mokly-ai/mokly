import type {
  ColorScheme,
  ComponentViewRecord,
  ManifestComponent,
  ManifestComponentVariant,
} from "@mokly/viewer";
import type { ManifestEntryBase } from "@mokly/viewer/data";
import {
  effectiveColorSchemes,
  VIEWPORTS,
  encodeProps,
  entryRoute,
  viewRoute,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";

import { componentInputs } from "./inputs.js";
import type {
  ComponentDefinition,
  ComponentVariantDefinition,
} from "./types.js";

/** Project one component parent without embedding its saved variants. */
export function componentManifestEntry(
  entry: ComponentDefinition & ResolvedRegistryEntry,
  common: Omit<ManifestEntryBase, "kind">,
): ManifestComponent {
  return {
    ...common,
    declaredDependencies: [...new Set(entry.dependencies)].sort(),
    kind: "component",
    route: entryRoute("component", entry.id),
    viewports: ["mobile", "desktop"],
    ...(entry.tags?.length ? { tags: [...entry.tags] } : {}),
    propSchema: entry.propSchema,
    controls: entry.controls,
    slots: entry.slots,
    ownedDependencies: entry.ownedDependencies,
  };
}

/** Project one flattened component variant and its generated view records. */
export function componentVariantManifestEntry(
  entry: ComponentVariantDefinition & ResolvedRegistryEntry,
  parent: ComponentDefinition,
  common: Omit<ManifestEntryBase, "kind">,
  schemes: readonly ColorScheme[],
  views: ReadonlyMap<string, ComponentViewRecord>,
): ManifestComponentVariant {
  const inputs = componentInputs(
    parent,
    entry.props,
    `${parent.id} / ${entry.id}`,
  );
  const fragment = (
    viewport: "mobile" | "desktop",
    scheme: ColorScheme = "light",
  ) => viewRoute("component", entry.id, viewport, scheme);
  return {
    ...common,
    declaredDependencies: [...new Set(entry.dependencies)].sort(),
    kind: "component",
    route: entryRoute("component", entry.id),
    viewports: ["mobile", "desktop"],
    ...(entry.tags?.length ? { tags: [...entry.tags] } : {}),
    variantOf: entry.variantOf,
    props: encodeProps(inputs.data),
    suppliedSlots: [...entry.suppliedSlots],
    fragments: {
      mobile: fragment("mobile"),
      desktop: fragment("desktop"),
    },
    ...(effectiveColorSchemes(entry, schemes).includes("dark")
      ? {
          darkFragments: {
            mobile: fragment("mobile", "dark"),
            desktop: fragment("desktop", "dark"),
          },
        }
      : {}),
    componentViews: VIEWPORTS.flatMap((viewport) =>
      effectiveColorSchemes(entry, schemes).flatMap(
        (scheme) => views.get(fragment(viewport, scheme)) ?? [],
      ),
    ),
  };
}
