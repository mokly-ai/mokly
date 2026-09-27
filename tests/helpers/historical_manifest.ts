import type { ManifestComponentVariant } from "../../packages/viewer/dist/components/manifest_types.js";
import {
  entryRoute,
  isManifestComponentVariant,
  viewRoute,
} from "../../packages/viewer/dist/data.js";
import type { ManifestV7 } from "../../packages/viewer/dist/registry/types.js";

type HistoricalVersion = 2 | 3 | 4 | 5 | 6;
type HistoricalFormat = "components" | "pages";

export interface LegacyManifestFixture extends Record<string, unknown> {
  entries: Array<Record<string, unknown> & { id: string; kind: string }>;
  generatedBy: "mockbook" | "mokly";
  schemaVersion: HistoricalVersion;
}

/** Reconstruct one genuine pre-v7 wire shape from a current test manifest. */
export function legacyManifestFromV7(
  manifest: ManifestV7,
  schemaVersion: HistoricalVersion,
  format: HistoricalFormat = schemaVersion === 4 && hasComponents(manifest)
    ? "components"
    : "pages",
): LegacyManifestFixture {
  const components =
    format === "components" || schemaVersion === 5 || schemaVersion === 6;
  const pages = schemaVersion >= 5 || (schemaVersion === 4 && !components);
  const entries = manifest.entries.flatMap((entry) => {
    if (entry.kind === "component" && isManifestComponentVariant(entry))
      return [];
    const common = legacyCommon(entry, components);
    if (entry.kind === "page")
      return [{ ...common, kind: "page", route: entryRoute("page", entry.id) }];
    if (entry.kind === "use-case")
      return [
        {
          ...common,
          kind: "use-case",
          route: entryRoute("use-case", entry.id),
          steps: entry.steps.map((step) => ({ ...step })),
          ...(entry.tags ? { tags: [...entry.tags] } : {}),
        },
      ];
    if (entry.kind === "screen") {
      const paths = legacyViews("screen", entry.id, entry.colorSchemes);
      return [
        {
          ...common,
          kind: "screen",
          route: entryRoute("screen", entry.id),
          viewports: ["mobile", "desktop"],
          fragments: paths.fragments,
          ...(paths.darkFragments
            ? { darkFragments: paths.darkFragments }
            : {}),
          useCaseIds: [...entry.useCaseIds],
          ...(entry.address ? { address: entry.address } : {}),
          ...(entry.tags ? { tags: [...entry.tags] } : {}),
          ...(entry.variantOf ? { variantOf: entry.variantOf } : {}),
          ...(components && entry.componentViews
            ? { componentViews: [...entry.componentViews] }
            : {}),
        },
      ];
    }
    if (!components) return [];
    const saved = manifest.entries.filter(
      (candidate): candidate is ManifestComponentVariant =>
        candidate.kind === "component" &&
        isManifestComponentVariant(candidate) &&
        candidate.variantOf === entry.id,
    );
    return [
      {
        ...common,
        kind: "component",
        route: entryRoute("component", entry.id),
        viewports: ["mobile", "desktop"],
        propSchema: entry.propSchema,
        slots: [...entry.slots],
        controls: entry.controls,
        ownedDependencies: [...entry.ownedDependencies],
        ...(entry.tags ? { tags: [...entry.tags] } : {}),
        variants: saved.map((variant) => {
          const paths = legacyViews(
            "component",
            variant.id,
            variant.colorSchemes,
          );
          return {
            id: variant.id,
            title: variant.title,
            description: variant.description,
            props: variant.props,
            suppliedSlots: [...variant.suppliedSlots],
            fragments: paths.fragments,
            ...(paths.darkFragments
              ? { darkFragments: paths.darkFragments }
              : {}),
            componentViews: [...variant.componentViews],
          };
        }),
      },
    ];
  });
  return {
    schemaVersion,
    generatedBy: schemaVersion === 2 ? "mockbook" : "mokly",
    entries,
    ...(pages
      ? { sourceFiles: [...manifest.sourceFiles] }
      : { legacyPages: [] }),
  };
}

function legacyCommon(
  entry: ManifestV7["entries"][number],
  components: boolean,
) {
  const dependencies = [
    ...new Set([entry.sourcePath, ...entry.declaredDependencies]),
  ].sort();
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    ...(entry.rationale ? { rationale: entry.rationale } : {}),
    relatedDocs: [...entry.relatedDocs],
    sourcePath: entry.sourcePath,
    navPath: [...entry.navPath],
    dependencies,
    ...(components
      ? { declaredDependencies: [...entry.declaredDependencies] }
      : {}),
  };
}

function legacyViews(
  kind: "component" | "screen",
  id: string,
  schemes: readonly ("dark" | "light")[],
) {
  const fragments = {
    mobile: viewRoute(kind, id, "mobile", "light"),
    desktop: viewRoute(kind, id, "desktop", "light"),
  };
  return schemes.includes("dark")
    ? {
        fragments,
        darkFragments: {
          mobile: viewRoute(kind, id, "mobile", "dark"),
          desktop: viewRoute(kind, id, "desktop", "dark"),
        },
      }
    : { fragments };
}

function hasComponents(manifest: ManifestV7): boolean {
  return manifest.entries.some((entry) => entry.kind === "component");
}
