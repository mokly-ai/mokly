/** Pure path membership from material paths and catalogue metadata. */
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  analyzeHierarchy,
  entryRoute,
  documentRoute,
  generatedViews,
  isManifestComponentVariant,
  type CatalogueHierarchy,
} from "@mokly/viewer/data";
import type {
  HistoricalManifest,
  HistoricalManifestEntry,
  ManifestEntry,
  ManifestV8,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

/** Match each entry, including every variant, against changed material and metadata. */
export function changedManifestPaths(
  manifest: ManifestV8,
  baseManifest: HistoricalManifest,
  config: ResolvedConfig,
  changedPaths: readonly string[],
): readonly string[] {
  const mockupsPrefix = toPosixPath(
    path.relative(config.repoRoot, config.mockupsDir),
  );
  const paths = new Set<string>();
  const changedScreenPaths = new Set<string>();
  const baseEntries = new Map(
    baseManifest.entries.map((entry) => [entry.path.toLowerCase(), entry]),
  );
  const hierarchy = analyzeHierarchy<ManifestEntry>(manifest.entries).hierarchy;
  const baseHierarchy = {
    variantParentByPath: new Map(
      baseManifest.entries.flatMap((entry) => {
        if (
          (entry.kind !== "screen" && entry.kind !== "component") ||
          !("variantOf" in entry) ||
          !entry.variantOf
        )
          return [];
        const parent = baseEntries.get(entry.variantOf.toLowerCase());
        return parent ? [[entry.path, parent] as const] : [];
      }),
    ),
  };
  for (const entry of manifest.entries) {
    const baseEntry = baseEntries.get(entry.path.toLowerCase());
    const candidates = changedPathCandidates(entry, baseEntry, mockupsPrefix);
    if (
      isDeepStrictEqual(
        changeProjection(entry, hierarchy),
        changeProjection(baseEntry, baseHierarchy),
      ) &&
      !candidates.some((candidate) => changedPaths.includes(candidate))
    )
      continue;
    paths.add(entry.path);
    if (entry.kind === "screen") changedScreenPaths.add(entry.path);
  }
  for (const entry of manifest.entries)
    if (
      entry.kind === "use-case" &&
      entry.steps.some((step) => changedScreenPaths.has(step.screenPath))
    )
      paths.add(entry.path);
  return [...paths].sort();
}

/** Select metadata whose changes can affect one Browse entry. */
function changeProjection(
  entry: ManifestEntry | HistoricalManifestEntry | undefined,
  hierarchy: Pick<
    CatalogueHierarchy<ManifestEntry | HistoricalManifestEntry>,
    "variantParentByPath"
  >,
): unknown {
  if (!entry) return undefined;
  const common = {
    description: entry.description,
    path: entry.path.toLowerCase(),
    kind: entry.kind,
    rationale: entry.rationale,
    relatedDocs: entry.relatedDocs,
    tags: entry.tags,
    title: entry.title,
  };
  if (entry.kind === "document")
    return JSON.stringify({ ...common, colorSchemes: entry.colorSchemes });
  if (entry.kind === "page") return common;
  if (entry.kind === "use-case") return { ...common, steps: entry.steps };
  if (entry.kind === "component" && isManifestComponentVariant(entry))
    return {
      ...common,
      colorSchemes: entry.colorSchemes,
      props: entry.props,
      suppliedSlots: entry.suppliedSlots,
      variantParent: projectedVariantParent(entry, hierarchy),
      variantOf: entry.variantOf?.toLowerCase(),
    };
  if (entry.kind === "component")
    return {
      ...common,
      colorSchemes: entry.colorSchemes,
      propSchema: entry.propSchema,
      controls: entry.controls,
      slots: entry.slots,
    };
  return {
    ...common,
    address: entry.address,
    colorSchemes: entry.colorSchemes,
    useCasePaths: entry.useCasePaths,
    variantParent: projectedVariantParent(entry, hierarchy),
    variantOf: entry.variantOf?.toLowerCase(),
  };
}

function projectedVariantParent(
  entry: ManifestEntry | HistoricalManifestEntry,
  hierarchy: Pick<
    CatalogueHierarchy<ManifestEntry | HistoricalManifestEntry>,
    "variantParentByPath"
  >,
): { path: string; title: string } | undefined {
  const parent = hierarchy.variantParentByPath.get(entry.path);
  return parent
    ? { path: parent.path.toLowerCase(), title: parent.title }
    : undefined;
}

function changedPathCandidates(
  entry: ManifestEntry,
  baseEntry: ManifestEntry | HistoricalManifestEntry | undefined,
  mockupsPrefix: string,
): string[] {
  const prefix = mockupsPrefix ? `${mockupsPrefix}/` : "";
  const current =
    entry.kind === "document"
      ? entry.colorSchemes.map((scheme) => documentRoute(entry.path, scheme))
      : entry.kind === "page"
        ? [entryRoute(entry.path)]
        : generatedViews(entry).map((view) => view.path);
  const baseline =
    baseEntry?.kind === "document"
      ? baseEntry.colorSchemes.map((scheme) =>
          documentRoute(baseEntry.path, scheme),
        )
      : baseEntry?.kind === "page"
        ? [entryRoute(baseEntry.path)]
        : baseEntry
          ? generatedViews(baseEntry).map((view) => view.path)
          : [];
  return [...new Set([...current, ...baseline])].map(
    (candidate) => `${prefix}${candidate}`,
  );
}
