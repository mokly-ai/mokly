/** Read-only material output checks for the catalogue Changes filter. */

import path from "node:path";

import { isAuthoringSource } from "../build/source_inventory.js";
import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  FORMER_MANIFEST_NAME,
  LEGACY_MANIFEST_NAME,
  MANIFEST_NAME,
} from "../registry/manifest.js";
import type { Manifest } from "../registry/types.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
  type OptionalReviewAssetReader,
} from "../review/assets.js";
import { baselineResourceConfig } from "../review/base_manifest.js";
import type { BaselineReader } from "../review/git.js";
import {
  normalizeHistoricalDocument,
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../review/ignore.js";
import type {
  ScreenResourceEvidence,
  ViewResourceEvidence,
} from "../review/types.js";

import { documentPairs, type DocumentPair } from "./changed_document_pairs.js";
import { ChangedResourceGraph } from "./changed_resources.js";

/** Material membership and per-view resource evidence from one traversal. */
export interface ChangedContent {
  changedPaths: readonly string[];
  screens: readonly ScreenResourceEvidence[];
}

/**
 * Find material document/resource changes using live files or a captured reader.
 * Exclude authoring paths lexically so retargeted public aliases still reach validation.
 */
export async function changedContentPaths(
  manifest: Manifest,
  baseline: Manifest,
  config: ResolvedConfig,
  git: BaselineReader,
  commit: string,
  changedPaths: readonly string[],
  headReader: OptionalReviewAssetReader = new FileSystemReviewAssetReader(
    config,
  ),
  documents: "all" | "pages" = "all",
): Promise<readonly string[]> {
  return (
    await classifyChangedContent(
      manifest,
      baseline,
      config,
      git,
      commit,
      changedPaths,
      headReader,
      documents,
    )
  ).changedPaths;
}

/** Preserve resource evidence from the v2 membership pass without repeating analysis. */
export async function classifyChangedContent(
  manifest: Manifest,
  baseline: Manifest,
  config: ResolvedConfig,
  git: BaselineReader,
  commit: string,
  changedPaths: readonly string[],
  headReader: OptionalReviewAssetReader = new FileSystemReviewAssetReader(
    config,
  ),
  documents: "all" | "pages" = "all",
): Promise<ChangedContent> {
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const repoPath = (route: string) => (prefix ? `${prefix}/${route}` : route);
  const publicChanges = new Set(
    changedPaths.flatMap((changed) => {
      const candidate = path.resolve(config.repoRoot, changed);
      if (
        !isInside(config.mockupsDir, candidate) ||
        isAuthoringSource(candidate, config, "exclusions") !== undefined
      )
        return [];
      const route = toPosixPath(path.relative(config.mockupsDir, candidate));
      return route === MANIFEST_NAME ||
        route === FORMER_MANIFEST_NAME ||
        route === LEGACY_MANIFEST_NAME
        ? []
        : [route];
    }),
  );
  const derived = config.generatedOutput === "derived";
  if (!derived && publicChanges.size === 0)
    return { changedPaths: [], screens: [] };
  const pairs = documentPairs(manifest, baseline, publicChanges, documents);
  if (derived) for (const pair of pairs) pair.changed = true;
  const baseReader = new GitReviewAssetReader(
    baselineResourceConfig(config, baseline),
    git,
    commit,
    prefix,
  );
  const result = new Set<string>();
  const normalizedDocuments = new Map<string, string>();
  const normalizedBases = new Map<string, string>();
  const headDocuments = new Map<string, string>();
  const changedPairs = pairs.filter(
    (pair): pair is DocumentPair & { base: string } =>
      pair.changed && pair.base !== undefined,
  );
  const readBases = async (
    batch: readonly (DocumentPair & { base: string })[],
  ) => {
    if (!batch.length) return;
    const bases = await timeAsync("review.base-documents", () =>
      baseReader.readMany(batch.map((pair) => pair.base)),
    );
    for (const pair of batch) {
      const base = bases.get(pair.base);
      if (!base)
        throw new MoklyError(
          "review-invalid",
          `base fragment is missing: ${pair.base}`,
        );
      const before = normalizeHistoricalDocument(
        Buffer.from(base).toString("utf8"),
      );
      const after =
        headDocuments.get(pair.head) ??
        Buffer.from(await headReader.read(pair.head)).toString("utf8");
      const normalized = normalizeReviewPair(before, after, pair.context);
      normalizedDocuments.set(pair.head, normalized.head);
      normalizedBases.set(pair.head, normalized.base);
      if (normalized.base !== normalized.head) {
        result.add(repoPath(pair.head));
        if (derived) publicChanges.add(pair.head);
      } else if (pair.base === pair.head) publicChanges.delete(pair.head);
    }
  };
  await timeAsync("review.compare-screens", async () => {
    for (let offset = 0; offset < changedPairs.length; offset += 32)
      await readBases(changedPairs.slice(offset, offset + 32));
  });
  if (!derived && publicChanges.size === 0)
    return { changedPaths: [...result].sort(), screens: [] };
  const screens = new Map<string, ViewResourceEvidence[]>();
  const resources = new ChangedResourceGraph(
    headReader,
    baseReader,
    publicChanges,
    normalizedDocuments,
    undefined,
    derived,
  );
  await timeAsync("review.compare-screens", async () => {
    for (let offset = 0; offset < pairs.length; offset += 32) {
      const batch = pairs.slice(offset, offset + 32);
      const cssPairs: (DocumentPair & { base: string })[] = [];
      for (const pair of batch) {
        if (!normalizedDocuments.has(pair.head)) {
          const after = Buffer.from(await headReader.read(pair.head)).toString(
            "utf8",
          );
          headDocuments.set(pair.head, after);
          normalizedDocuments.set(
            pair.head,
            pair.base
              ? normalizeReviewPair(after, after, pair.context).head
              : normalizeSingleDocument(after, pair.context),
          );
        }
        if (
          (await resources.hasChangedStylesheet(
            pair.head,
            normalizedDocuments.get(pair.head)!,
          )) &&
          pair.base !== undefined &&
          !normalizedBases.has(pair.head)
        )
          cssPairs.push({ ...pair, base: pair.base });
      }
      await readBases(cssPairs);
      for (const pair of batch) {
        const document = normalizedDocuments.get(pair.head)!;
        const before = normalizedBases.get(pair.head);
        const evidence = await resources.compare(
          pair.head,
          document,
          pair.base && before !== undefined
            ? { path: pair.base, html: before }
            : undefined,
        );
        if (evidence.reasons?.length || evidence.resourceChanged)
          result.add(repoPath(pair.head));
        if (
          pair.view &&
          (evidence.reasons?.length || evidence.excludedResources?.length)
        ) {
          const { route, viewport, colorScheme } = pair.view;
          const views = screens.get(route) ?? [];
          views.push({
            viewport,
            colorScheme,
            ...(evidence.reasons
              ? {
                  reasons: evidence.reasons.map((reason) => ({
                    ...reason,
                    path: repoPath(reason.path),
                  })),
                }
              : {}),
            ...(evidence.excludedResources
              ? {
                  excludedResources: evidence.excludedResources.map(
                    (resource) => ({
                      ...resource,
                      path: repoPath(resource.path),
                    }),
                  ),
                }
              : {}),
          });
          screens.set(route, views);
        }
      }
    }
  });
  return {
    changedPaths: [...result].sort(),
    screens: [...screens.keys()]
      .sort()
      .map((route) => ({ route, views: screens.get(route)! })),
  };
}
