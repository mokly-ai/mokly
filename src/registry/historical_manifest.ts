/** Historical manifest normalization confines every stored artifact path. */
import type { ComponentViewRecord } from "@mokly/viewer";
import {
  entryRoute,
  legacyComponentVariantId,
  viewRoute,
} from "@mokly/viewer/data";
import type {
  ColorScheme,
  HistoricalArtifactView,
  HistoricalManifest,
  HistoricalManifestEntry,
  Viewport,
} from "@mokly/viewer/data";

interface RawManifest {
  entries: readonly Record<string, unknown>[];
  generatedBy: "mokly";
  legacyPages?: readonly Record<string, unknown>[];
  schemaVersion: 3 | 4 | 5 | 6 | 7;
  sourceFiles?: readonly string[];
}

/** Convert one validated historical wire shape into the internal read shape. */
export function normalizeHistoricalManifest(
  manifest: RawManifest,
): HistoricalManifest {
  return {
    entries: manifest.entries.flatMap((entry) =>
      normalizeEntry(entry, manifest.schemaVersion),
    ),
    generatedBy: "mokly",
    ...(manifest.legacyPages
      ? {
          legacyPages: manifest.legacyPages.map((page) => ({
            artifactPath: page.route as string,
            sourcePath: page.sourcePath as string,
          })),
        }
      : {}),
    schemaVersion: manifest.schemaVersion,
    ...(manifest.sourceFiles ? { sourceFiles: [...manifest.sourceFiles] } : {}),
  };
}

function normalizeEntry(
  entry: Record<string, unknown>,
  schemaVersion: RawManifest["schemaVersion"],
): HistoricalManifestEntry[] {
  const current = schemaVersion === 7;
  const kind = entry.kind as HistoricalManifestEntry["kind"];
  const common = commonFields(entry, current);
  if (kind === "page")
    return [
      {
        ...common,
        artifactPath: current
          ? entryRoute("page", common.id)
          : (entry.route as string),
        kind,
        ...(entry.tags ? { tags: [...(entry.tags as string[])] } : {}),
      },
    ];
  if (kind === "use-case")
    return [
      {
        ...common,
        kind,
        steps: (
          entry.steps as {
            description?: string;
            screenId: string;
            title?: string;
          }[]
        ).map((step) => ({ ...step })),
        ...(entry.tags ? { tags: [...(entry.tags as string[])] } : {}),
      },
    ];
  if (kind === "screen") {
    const colorSchemes = schemes(entry, current);
    return [
      {
        ...common,
        ...(entry.address ? { address: entry.address as string } : {}),
        artifacts: artifactViews(
          "screen",
          common.id,
          entry,
          current,
          colorSchemes,
        ),
        colorSchemes,
        kind,
        ...(entry.tags ? { tags: [...(entry.tags as string[])] } : {}),
        useCaseIds: [...(entry.useCaseIds as string[])],
        ...(entry.variantOf ? { variantOf: entry.variantOf as string } : {}),
      },
    ];
  }
  const colorSchemes = componentSchemes(entry, current);
  if (typeof entry.variantOf === "string")
    return [
      {
        ...common,
        artifacts: artifactViews(
          "component",
          common.id,
          entry,
          current,
          colorSchemes,
        ),
        colorSchemes,
        componentViews: [
          ...((entry.componentViews as ComponentViewRecord[]) ?? []),
        ],
        kind: "component",
        props: entry.props as never,
        suppliedSlots: [...(entry.suppliedSlots as string[])],
        ...(entry.tags ? { tags: [...(entry.tags as string[])] } : {}),
        variantOf: entry.variantOf,
      },
    ];
  const parent: HistoricalManifestEntry = {
    ...common,
    colorSchemes,
    controls: entry.controls as never,
    kind: "component",
    ownedDependencies: [...(entry.ownedDependencies as string[])],
    propSchema: entry.propSchema as never,
    slots: [...(entry.slots as string[])],
    ...(entry.tags ? { tags: [...(entry.tags as string[])] } : {}),
  };
  const variants = Array.isArray(entry.variants) ? entry.variants : [];
  return [
    parent,
    ...variants.map((variant) => {
      const raw = variant as Record<string, unknown>;
      const id = legacyComponentVariantId(common.id, raw.id as string);
      const variantSchemes = schemes(raw, false);
      return {
        ...common,
        artifacts: artifactViews("component", id, raw, false, variantSchemes),
        colorSchemes: variantSchemes,
        componentViews: [
          ...((raw.componentViews as ComponentViewRecord[]) ?? []),
        ],
        description:
          (raw.description as string | undefined) ?? common.description,
        id,
        kind: "component" as const,
        props: raw.props as never,
        suppliedSlots: [...(raw.suppliedSlots as string[])],
        title: raw.title as string,
        variantOf: common.id,
        ...(entry.tags ? { tags: [...(entry.tags as string[])] } : {}),
      };
    }),
  ];
}

function commonFields(entry: Record<string, unknown>, current: boolean) {
  const declaredDependencies = Array.isArray(entry.declaredDependencies)
    ? [...(entry.declaredDependencies as string[])]
    : [];
  const sourcePath = entry.sourcePath as string;
  return {
    declaredDependencies,
    dependencies: current
      ? [...new Set([sourcePath, ...declaredDependencies])].sort()
      : [...(entry.dependencies as string[])],
    description: entry.description as string,
    id: entry.id as string,
    navPath: [...(entry.navPath as string[])],
    ...(entry.rationale ? { rationale: entry.rationale as string } : {}),
    relatedDocs: [...(entry.relatedDocs as string[])],
    sourcePath,
    title: entry.title as string,
  };
}

function componentSchemes(
  entry: Record<string, unknown>,
  current: boolean,
): readonly ColorScheme[] {
  if (current) return [...(entry.colorSchemes as ColorScheme[])];
  const variants = Array.isArray(entry.variants) ? entry.variants : [];
  return variants.some(
    (variant) =>
      typeof variant === "object" &&
      variant !== null &&
      "darkFragments" in variant &&
      variant.darkFragments !== undefined,
  )
    ? ["light", "dark"]
    : ["light"];
}

function schemes(
  entry: Record<string, unknown>,
  current: boolean,
): readonly ColorScheme[] {
  return current
    ? [...(entry.colorSchemes as ColorScheme[])]
    : entry.darkFragments === undefined
      ? ["light"]
      : ["light", "dark"];
}

function artifactViews(
  kind: "component" | "screen",
  id: string,
  entry: Record<string, unknown>,
  current: boolean,
  colorSchemes: readonly ColorScheme[],
): HistoricalArtifactView[] {
  const usage = Array.isArray(entry.componentViews)
    ? (entry.componentViews as ComponentViewRecord[])
    : [];
  return (["mobile", "desktop"] as const).flatMap((viewport) =>
    colorSchemes.map((colorScheme) => ({
      colorScheme,
      path: current
        ? viewRoute(kind, id, viewport, colorScheme)
        : storedViewPath(entry, viewport, colorScheme),
      viewport,
      ...usageFor(usage, viewport, colorScheme),
    })),
  );
}

function storedViewPath(
  entry: Record<string, unknown>,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string {
  const field = colorScheme === "dark" ? "darkFragments" : "fragments";
  return (entry[field] as Record<Viewport, string>)[viewport];
}

function usageFor(
  views: readonly ComponentViewRecord[],
  viewport: Viewport,
  colorScheme: ColorScheme,
): { usage?: ComponentViewRecord } {
  const usage = views.find(
    (view) => view.viewport === viewport && view.colorScheme === colorScheme,
  );
  return usage ? { usage } : {};
}
