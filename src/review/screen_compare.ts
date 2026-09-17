/** Shared screen comparison policy for complete artifacts and selected live panes. */
import crypto from "node:crypto";

import type { ColorScheme, Viewport } from "@mokly/viewer";
import type {
  ManifestScreen,
  ReviewArtifactContent,
  ScreenReview,
  ViewReview,
} from "@mokly/viewer/data";
import { VIEWPORTS } from "@mokly/viewer/data";

import type { Compilation } from "../build/compile.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { dependencyContainsChangedPath } from "../registry/dependency_paths.js";

import {
  analysisOwnsStylesheet,
  assertViewAnalysisScope,
} from "./css/paths.js";
import {
  normalizeHistoricalDocument,
  normalizeReviewPair,
  normalizeSingleDocument,
} from "./ignore.js";
import { addArtifactFile, snapshotPath } from "./paths.js";
import type { ResourceComparison } from "./resource_comparison.js";
import {
  aggregateState,
  fragmentForView,
  unionColorSchemes,
} from "./screen_views.js";

/** Compare every viewport/scheme of one route, preserving its original documents. */
export async function compareScreen(
  base: ManifestScreen | undefined,
  head: ManifestScreen | undefined,
  baseDocuments: ReadonlyMap<string, Uint8Array>,
  compilation: Pick<Compilation, "outputs">,
  changedPaths: readonly string[],
  sharedImpact: readonly string[],
  files: Map<string, ReviewArtifactContent>,
  baseSeeds: Set<string>,
  headSeeds: Set<string>,
  resources: ResourceComparison,
  config: ResolvedConfig,
): Promise<ScreenReview> {
  const entry = head ?? base;
  if (!entry)
    throw new MoklyError("review-invalid", "comparison route has no screen");
  const views: ViewReview[] = [];
  for (const viewport of VIEWPORTS) {
    for (const colorScheme of unionColorSchemes(base, head)) {
      const baseFragment = base
        ? fragmentForView(base, viewport, colorScheme)
        : undefined;
      const headFragment = head
        ? fragmentForView(head, viewport, colorScheme)
        : undefined;
      const baseDocument = baseFragment
        ? baseDocuments.get(baseFragment)
        : undefined;
      if (baseFragment && !baseDocument) {
        throw new MoklyError(
          "review-invalid",
          `base fragment is missing: ${baseFragment}`,
        );
      }
      const before = baseDocument
        ? Buffer.from(baseDocument).toString("utf8")
        : undefined;
      const after = headFragment
        ? compilation.outputs.get(headFragment)
        : undefined;
      if (headFragment && after === undefined) {
        throw new MoklyError(
          "review-invalid",
          `head fragment is missing: ${headFragment}`,
        );
      }
      const beforePath = baseFragment
        ? snapshotPath("before", baseFragment)
        : undefined;
      const afterPath = headFragment
        ? snapshotPath("after", headFragment)
        : undefined;
      if (before !== undefined && beforePath && baseFragment) {
        addArtifactFile(files, beforePath, before);
        baseSeeds.add(baseFragment);
      }
      if (after !== undefined && afterPath && headFragment) {
        addArtifactFile(files, afterPath, after);
        headSeeds.add(headFragment);
      }
      const view = compareView(
        before,
        after,
        entry.route,
        viewport,
        colorScheme,
        beforePath,
        afterPath,
      );
      const normalized =
        before !== undefined && after !== undefined
          ? normalizeReviewPair(
              normalizeHistoricalDocument(before),
              after,
              entry.route,
            )
          : {
              base:
                before === undefined
                  ? undefined
                  : normalizeSingleDocument(
                      normalizeHistoricalDocument(before),
                      entry.route,
                    ),
              head:
                after === undefined
                  ? undefined
                  : normalizeSingleDocument(after, entry.route),
            };
      const evidence = await resources.compare(
        baseFragment && normalized.base !== undefined
          ? { path: baseFragment, html: normalized.base }
          : undefined,
        headFragment && normalized.head !== undefined
          ? { path: headFragment, html: normalized.head }
          : undefined,
      );
      views.push({
        ...view,
        ...evidence,
        state:
          view.state !== "added" &&
          view.state !== "removed" &&
          evidence.reasons?.length
            ? "changed"
            : view.state,
      });
    }
  }
  assertViewAnalysisScope(views, config);
  const dependencies = [
    ...new Set([...(base?.dependencies ?? []), ...(head?.dependencies ?? [])]),
  ].sort();
  const dependencyImpact = changedPaths.filter((changedPath) =>
    dependencies.some((dependency) =>
      dependencyContainsChangedPath(dependency, changedPath),
    ),
  );
  return {
    dependencies,
    id: entry.id,
    route: entry.route,
    sharedImpact: [
      ...new Set([
        ...[...sharedImpact, ...dependencyImpact].filter(
          (path) => !analysisOwnsStylesheet(path, config),
        ),
        ...views.flatMap(
          (view) => view.reasons?.map((reason) => reason.path) ?? [],
        ),
      ]),
    ].sort(),
    state: aggregateState(views.map((view) => view.state)),
    title: entry.title,
    views,
  };
}

function compareView(
  before: string | undefined,
  after: string | undefined,
  route: string,
  viewport: Viewport,
  colorScheme: ColorScheme,
  beforePath: string | undefined,
  afterPath: string | undefined,
): ViewReview {
  const context = `${route} (${viewport}, ${colorScheme})`;
  const historicalBefore =
    before === undefined ? undefined : normalizeHistoricalDocument(before);
  const normalizedBefore =
    historicalBefore === undefined
      ? undefined
      : normalizeSingleDocument(historicalBefore, context);
  const normalizedAfter =
    after === undefined ? undefined : normalizeSingleDocument(after, context);
  if (before === undefined)
    return {
      ...(afterPath ? { afterPath } : {}),
      colorScheme,
      ignoredIds: [],
      material: true,
      state: "added",
      viewport,
    };
  if (after === undefined)
    return {
      ...(beforePath ? { beforePath } : {}),
      colorScheme,
      ignoredIds: [],
      material: true,
      state: "removed",
      viewport,
    };
  const normalized = normalizeReviewPair(
    normalizeHistoricalDocument(before),
    after,
    context,
  );
  const normalizedEqual = digest(normalized.base) === digest(normalized.head);
  const rawEqual =
    digest(normalizedBefore ?? "") === digest(normalizedAfter ?? "");
  return {
    ...(afterPath ? { afterPath } : {}),
    ...(beforePath ? { beforePath } : {}),
    colorScheme,
    ignoredIds: normalized.ignoredIds,
    ...(!normalizedEqual ? { material: true as const } : {}),
    state: rawEqual
      ? "unchanged"
      : normalizedEqual
        ? "ignored-only"
        : "changed",
    viewport,
  };
}

function digest(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}
