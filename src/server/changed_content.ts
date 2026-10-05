/** Read-only material output checks for the catalogue Changes filter. */

import path from "node:path";

import type {
  HistoricalManifest,
  ManifestV8,
  ScreenResourceEvidence,
  PageResourceEvidence,
  ReviewResultV5,
  ViewResourceEvidence,
} from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { documentResourceIndex } from "../documents/resource_references.js";
import { MoklyError } from "../errors.js";
import {
  FileSystemReviewAssetReader,
  GitReviewAssetReader,
  type OptionalReviewAssetReader,
  type ReviewAssetReader,
} from "../review/assets.js";
import { baselineResourceConfig } from "../review/base_manifest.js";
import type { ChangeEvidence } from "../review/change_evidence.js";
import { CssResourceAnalysis } from "../review/css/resource_analysis.js";
import type { BaselineReader } from "../review/git.js";
import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../review/ignore.js";
import { catalogueLinkNormalizer } from "../review/moves/links.js";
import {
  readMoveResources,
  type MoveResources,
} from "../review/moves/resources.js";
import type { MovePairing } from "../review/moves/types.js";

import {
  publicChangedRoutes,
  documentPairs,
  type DocumentPair,
} from "./changed_document_pairs.js";
import { ChangedResourceGraph } from "./changed_resources.js";
import { classifiedScreenCss } from "./classified_css.js";
import { contentResourceEvidence } from "./content_resource_evidence.js";

/** Material membership and per-view resource evidence from one traversal. */
export interface ChangedContent {
  changedPaths: readonly string[];
  screens: readonly ScreenResourceEvidence[];
  pages: readonly PageResourceEvidence[];
}

/** Reuse the comparison's accepted pairing and retained baseline reads. */
export interface ChangedContentComparison {
  pairing?: MovePairing;
  beforeReader?: ReviewAssetReader;
  resources?: MoveResources;
}

/**
 * Find material document/resource changes using live files or a captured reader.
 * Exclude authoring paths lexically so retargeted public aliases still reach validation.
 */
export async function changedContentPaths(
  manifest: ManifestV8,
  baseline: HistoricalManifest,
  config: ResolvedConfig,
  git: BaselineReader,
  commit: string,
  changedPaths: ChangeEvidence,
  headReader: OptionalReviewAssetReader = new FileSystemReviewAssetReader(
    config,
  ),
  documents: "all" | "pages" = "all",
  comparison?: ChangedContentComparison,
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
      comparison,
    )
  ).changedPaths;
}

/** Preserve rendered-resource evidence from membership without repeating analysis. */
export async function classifyChangedContent(
  manifest: ManifestV8,
  baseline: HistoricalManifest,
  config: ResolvedConfig,
  git: BaselineReader,
  commit: string,
  changedPaths: ChangeEvidence,
  headReader: OptionalReviewAssetReader = new FileSystemReviewAssetReader(
    config,
  ),
  documents: "all" | "pages" = "all",
  comparison?: ChangedContentComparison,
  css: CssResourceAnalysis = new CssResourceAnalysis(),
  classified?: ReviewResultV5,
): Promise<ChangedContent> {
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  const repoPath = (route: string) => (prefix ? `${prefix}/${route}` : route);
  const publicChanges = publicChangedRoutes(changedPaths, config);
  const derived = config.generatedOutput === "derived";
  if (
    !derived &&
    publicChanges.size === 0 &&
    !comparison?.pairing?.moves.length
  )
    return { changedPaths: [], screens: [], pages: [] };
  const moves = comparison?.pairing?.moves ?? [];
  const pairs = documentPairs(
    manifest,
    baseline,
    publicChanges,
    documents,
    moves,
  );
  if (derived) for (const pair of pairs) pair.changed = true;
  const baseReader =
    comparison?.beforeReader ??
    new GitReviewAssetReader(
      baselineResourceConfig(config, baseline),
      git,
      commit,
      prefix,
    );
  const identities =
    comparison?.resources ??
    (
      await readMoveResources(
        baseline.entries,
        manifest.entries,
        baseReader,
        headReader,
      )
    ).paired(baseline.entries, manifest.entries, moves);
  const links = catalogueLinkNormalizer(
    baseline.entries,
    manifest.entries,
    moves,
    identities,
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
      baseReader.readMany
        ? baseReader.readMany(batch.map((pair) => pair.base))
        : Promise.all(
            batch.map(
              async (pair) =>
                [pair.base, await baseReader.read(pair.base)] as const,
            ),
          ).then((entries) => new Map(entries)),
    );
    for (const pair of batch) {
      const base = bases.get(pair.base);
      if (!base)
        throw new MoklyError(
          "review-invalid",
          `base fragment is missing: ${pair.base}`,
        );
      const before = Buffer.from(base).toString("utf8");
      const after =
        headDocuments.get(pair.head) ??
        Buffer.from(await headReader.read(pair.head)).toString("utf8");
      const normalized = normalizeReviewPair(
        before,
        after,
        pair.context,
        links(pair.base, pair.head),
      );
      normalizedDocuments.set(
        pair.head,
        normalized.resourceHead ?? normalized.head,
      );
      normalizedBases.set(
        pair.head,
        normalized.resourceBase ?? normalized.base,
      );
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
    return { changedPaths: [...result].sort(), screens: [], pages: [] };
  const screens = new Map<string, ViewResourceEvidence[]>();
  const pages: PageResourceEvidence[] = [];
  const resources = new ChangedResourceGraph(
    headReader,
    baseReader,
    publicChanges,
    normalizedDocuments,
    css,
    derived,
    {
      before: documentResourceIndex(baseline.entries),
      after: documentResourceIndex(manifest.entries),
    },
    identities,
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
          classifiedScreenCss(classified, pair.view, prefix),
        );
        if (evidence.reasons?.length || evidence.resourceChanged)
          result.add(repoPath(pair.head));
        if (!evidence.reasons?.length && !evidence.excludedResources?.length)
          continue;
        const projected = contentResourceEvidence(evidence, repoPath);
        if (pair.pagePath) pages.push({ path: pair.pagePath, ...projected });
        if (pair.view) {
          const { path, viewport, colorScheme } = pair.view;
          const views = screens.get(path) ?? [];
          views.push({ viewport, colorScheme, ...projected });
          screens.set(path, views);
        }
      }
    }
  });
  return {
    changedPaths: [...result].sort(),
    pages: pages.sort((a, b) => (a.path < b.path ? -1 : 1)),
    screens: [...screens.keys()]
      .sort()
      .map((path) => ({ path, views: screens.get(path)! })),
  };
}
