/** Shared screen comparison policy for complete artifacts and selected live panes. */
import crypto from "node:crypto";

import type { ColorScheme, Viewport } from "@mokly/viewer";
import type {
  ManifestScreen,
  HistoricalManifestScreen,
  ReviewArtifactContent,
  ScreenReview,
  ViewReview,
} from "@mokly/viewer/data";
import { entryRoute, viewRoute, VIEWPORTS } from "@mokly/viewer/data";

import type { Compilation } from "../build/compile.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import { dependencyContainsChangedPath } from "../registry/dependency_paths.js";

import {
  analysisOwnsStylesheet,
  assertViewAnalysisScope,
} from "./css/paths.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import { addArtifactFile, snapshotPath } from "./paths.js";
import type { ResourceComparison } from "./resource_comparison.js";
import {
  aggregateState,
  fragmentForView,
  unionColorSchemes,
} from "./screen_views.js";

/** Compare every viewport/scheme of one route, preserving its original documents. */
export async function compareScreen(
  base: ManifestScreen | HistoricalManifestScreen | undefined,
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
      const canonicalView = viewRoute(
        "screen",
        entry.id,
        viewport,
        colorScheme,
      );
      const beforePath = baseFragment
        ? snapshotPath("before", canonicalView)
        : undefined;
      const afterPath = headFragment
        ? snapshotPath("after", canonicalView)
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
        entryRoute("screen", entry.id),
        viewport,
        colorScheme,
      );
      const normalized =
        before !== undefined && after !== undefined
          ? normalizeReviewPair(before, after, entryRoute("screen", entry.id))
          : {
              base:
                before === undefined
                  ? undefined
                  : normalizeSingleDocument(
                      before,
                      entryRoute("screen", entry.id),
                    ),
              head:
                after === undefined
                  ? undefined
                  : normalizeSingleDocument(
                      after,
                      entryRoute("screen", entry.id),
                    ),
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
    ...new Set([
      ...(base ? [base.sourcePath, ...base.declaredDependencies] : []),
      ...(head ? [head.sourcePath, ...head.declaredDependencies] : []),
    ]),
  ].sort();
  const dependencyImpact = changedPaths.filter((changedPath) =>
    dependencies.some((dependency) =>
      dependencyContainsChangedPath(dependency, changedPath),
    ),
  );
  return {
    dependencies,
    id: entry.id,
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
): ViewReview {
  const context = `${route} (${viewport}, ${colorScheme})`;
  const normalizedBefore =
    before === undefined ? undefined : normalizeSingleDocument(before, context);
  const normalizedAfter =
    after === undefined ? undefined : normalizeSingleDocument(after, context);
  if (before === undefined)
    return {
      colorScheme,
      ignoredIds: [],
      material: true,
      state: "added",
      viewport,
    };
  if (after === undefined)
    return {
      colorScheme,
      ignoredIds: [],
      material: true,
      state: "removed",
      viewport,
    };
  const normalized = normalizeReviewPair(before, after, context);
  const normalizedEqual = digest(normalized.base) === digest(normalized.head);
  const rawEqual =
    digest(normalizedBefore ?? "") === digest(normalizedAfter ?? "");
  return {
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
