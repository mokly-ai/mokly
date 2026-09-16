/** Pure route membership from material paths and catalogue metadata. */
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { analyzeHierarchy, type CatalogueHierarchy } from "@mokly/viewer/data";
import type { Manifest, ManifestEntry } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

/** Match manifest entries against repository-relative changed paths. */
export function changedManifestRoutes(
  manifest: Manifest,
  baseManifest: Manifest,
  config: ResolvedConfig,
  changedPaths: readonly string[],
): readonly string[] {
  const mockupsPrefix = toPosixPath(
    path.relative(config.repoRoot, config.mockupsDir),
  );
  const routes = new Set<string>();
  const changedScreenIds = new Set<string>();
  const baseEntries = new Map(
    baseManifest.entries.map((entry) => [entry.id, entry]),
  );
  const hierarchy = analyzeHierarchy<ManifestEntry>(manifest.entries).hierarchy;
  const baseHierarchy = analyzeHierarchy<ManifestEntry>(
    baseManifest.entries,
  ).hierarchy;
  for (const entry of manifest.entries) {
    if (entry.kind === "collection") continue;
    const baseEntry = baseEntries.get(entry.id);
    const candidates = changedPathCandidates(entry, baseEntry, mockupsPrefix);
    if (
      isDeepStrictEqual(
        routeChangeProjection(entry, hierarchy),
        routeChangeProjection(baseEntry, baseHierarchy),
      ) &&
      !candidates.some((candidate) =>
        changedPaths.some((changedPath) => candidate === changedPath),
      )
    ) {
      continue;
    }
    routes.add(entry.route);
    if (entry.kind === "screen") changedScreenIds.add(entry.id);
  }
  for (const entry of manifest.entries) {
    if (
      entry.kind === "use-case" &&
      entry.steps.some((step) => changedScreenIds.has(step.screenId))
    ) {
      routes.add(entry.route);
    }
  }
  return [...routes].sort();
}

/** Select manifest metadata whose changes can affect a routed Browse entry. */
function routeChangeProjection(
  entry: ManifestEntry | undefined,
  hierarchy: CatalogueHierarchy<ManifestEntry>,
): unknown {
  if (!entry) return undefined;
  const common = {
    ancestorCollections: (hierarchy.ancestorsById.get(entry.id) ?? []).map(
      ({ id, title }) => ({ id, title }),
    ),
    description: entry.description,
    id: entry.id,
    kind: entry.kind,
    rationale: entry.rationale,
    relatedDocs: entry.relatedDocs,
    tags: entry.kind === "collection" ? undefined : entry.tags,
    title: entry.title,
  };
  if (entry.kind === "collection") {
    return { ...common, childIds: entry.childIds };
  }
  if (entry.kind === "page") return { ...common, route: entry.route };
  if (entry.kind === "use-case") {
    return { ...common, route: entry.route, steps: entry.steps };
  }
  if (entry.kind === "component")
    return {
      ...common,
      route: entry.route,
      propSchema: entry.propSchema,
      controls: entry.controls,
      slots: entry.slots,
      variants: entry.variants.map(
        ({ componentViews: _views, ...variant }) => variant,
      ),
    };
  return {
    ...common,
    address: entry.address,
    darkFragments: entry.darkFragments,
    fragments: entry.fragments,
    route: entry.route,
    useCaseIds: entry.useCaseIds,
    viewports: entry.viewports,
  };
}

function changedPathCandidates(
  entry: ManifestEntry,
  baseEntry: ManifestEntry | undefined,
  mockupsPrefix: string,
): string[] {
  const candidates: string[] = [];
  const prefix = mockupsPrefix ? `${mockupsPrefix}/` : "";
  for (const candidate of [entry, baseEntry]) {
    if (candidate?.kind === "page")
      candidates.push(`${prefix}${candidate.route}`);
    if (candidate?.kind !== "screen") continue;
    candidates.push(
      `${prefix}${candidate.fragments.mobile}`,
      `${prefix}${candidate.fragments.desktop}`,
    );
    if (candidate.darkFragments) {
      candidates.push(
        `${prefix}${candidate.darkFragments.mobile}`,
        `${prefix}${candidate.darkFragments.desktop}`,
      );
    }
  }
  return [...new Set(candidates)];
}
