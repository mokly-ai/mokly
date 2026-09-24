import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";

import {
  stripHistoricalMarkers,
  stripMarkers,
} from "../components/comparison_material.js";
import { changedComponentImplementations } from "../components/comparison_projection.js";
import { validateComponentRanges } from "../components/ranges.js";
import { MoklyError } from "../errors.js";

import type { ComponentDependencyPolicy } from "./component_metadata.js";
import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import {
  ownedCssReasons,
  type OwnedCssReason,
} from "./component_resource_attribution.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type { ComponentMaterialReader } from "./component_resources.js";
import { compareUnchangedComponentView } from "./component_view_fast_path.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import { normalizeDocumentUrls } from "./normalize_urls.js";
import { snapshotPath } from "./paths.js";
import type { ResourceComparison } from "./resource_comparison.js";

export interface ComparedComponentView {
  comparisonPath: "fast" | "complete";
  view: ViewReview;
  reasons: readonly EntryChangeReason[];
  changedImplementations: ReadonlySet<string>;
  ownedResources: readonly OwnedCssReason[];
}
export interface ComponentViewContext {
  beforeReader: ComponentMaterialReader;
  afterReader: ComponentMaterialReader;
  dependencies: ComponentDependencyPolicy;
  changed: ReadonlySet<string>;
  prefix: string;
  resources: ResourceComparison;
  compareResourceBytes?: boolean;
  useFastPath?: boolean;
}
/** Compare material and declared inputs without altering the retained view documents. */
export async function compareComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView | undefined,
  after: GeneratedComponentView | undefined,
  root?: string,
): Promise<ComparedComponentView> {
  const selected = after ?? before;
  if (!selected)
    throw new MoklyError(
      "review-invalid",
      "Comparison view requires at least one side",
    );
  const base = before
    ? await context.beforeReader.text(before.path)
    : undefined;
  const head = after ? await context.afterReader.text(after.path) : undefined;
  const view: ViewReview = {
    viewport: selected.viewport,
    colorScheme: selected.colorScheme,
    ignoredIds: [],
    ...(before ? { beforePath: snapshotPath("before", before.path) } : {}),
    ...(after ? { afterPath: snapshotPath("after", after.path) } : {}),
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined) {
    const normalized =
      base !== undefined
        ? normalizeOneSidedView(base, before!, "historical")
        : normalizeOneSidedView(head!, after!, "current");
    const evidence = await context.resources.compare(
      before ? { path: before.path, html: normalized } : undefined,
      after ? { path: after.path, html: normalized } : undefined,
    );
    return {
      comparisonPath: "complete",
      view: { ...view, ...evidence, material: true },
      reasons: [{ kind: "material" }, ...(evidence.reasons ?? [])],
      changedImplementations: new Set(),
      ownedResources: ownedCssReasons(
        evidence.reasons ?? [],
        context.dependencies,
        context.prefix,
        before?.usage,
        after?.usage,
        root,
      ),
    };
  }
  let prepared: PreparedComponentComparison | undefined;
  if (context.useFastPath !== false) {
    const attempt = await compareUnchangedComponentView(
      context,
      before!,
      after!,
      view,
      base,
      head,
      root,
    );
    if (attempt.comparison) return attempt.comparison;
    prepared = attempt.prepared;
  }
  prepared ??= prepareComponentProjection(
    context,
    before!,
    after!,
    base,
    head,
    root,
  );
  const { baseRanges, headRanges, projected, excluded } = prepared;
  const reasons: EntryChangeReason[] = [];
  if (
    normalizeDocumentUrls(
      projected.before,
      before!.path,
      context.beforeReader.generated.prefix,
      context.beforeReader.generated.routes,
    ) !==
    normalizeDocumentUrls(
      projected.after,
      after!.path,
      context.afterReader.generated.prefix,
      context.afterReader.generated.routes,
    )
  )
    reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actual = normalizeReviewPair(
    stripHistoricalMarkers(base),
    stripMarkers(head, after?.usage, headRanges),
    selected.path,
    {
      before: context.beforeReader.generated.prefix,
      after: context.afterReader.generated.prefix,
      beforeRoutes: context.beforeReader.generated.routes,
      afterRoutes: context.afterReader.generated.routes,
    },
  );
  const materialChanged =
    (actual.comparisonBase ?? actual.base) !==
    (actual.comparisonHead ?? actual.head);
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    { path: before!.path, html: projected.before },
    { path: after!.path, html: projected.after },
    excluded,
    { before: actual.base, after: actual.head },
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    { path: before!.path, html: actual.base },
    { path: after!.path, html: actual.head },
  );
  const byteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          projected.before,
          excluded,
        ),
        await context.afterReader.resources(
          after!.path,
          projected.after,
          excluded,
        ),
        context.beforeReader,
        context.afterReader,
      )
    : new Set<string>();
  if ([...byteChanges].some((route) => !context.changed.has(repoPath(route))))
    reasons.push({ kind: "material" });
  const actualByteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(before!.path, actual.base),
        await context.afterReader.resources(after!.path, actual.head),
        context.beforeReader,
        context.afterReader,
      )
    : new Set<string>();
  const actualResourceChange =
    Boolean(actualEvidence.reasons?.length) ||
    [...actualByteChanges].some(
      (route) => !context.changed.has(repoPath(route)),
    );
  return {
    comparisonPath: "complete",
    ownedResources: ownedCssReasons(
      actualEvidence.reasons ?? [],
      context.dependencies,
      context.prefix,
      before?.usage,
      after?.usage,
      root,
    ),
    changedImplementations: changedComponentImplementations(
      base,
      head,
      before?.usage,
      after?.usage,
      baseRanges,
      headRanges,
    ),
    view: {
      ...view,
      ...actualEvidence,
      ignoredIds: actual.ignoredIds,
      ...(materialChanged ? { material: true as const } : {}),
      state:
        materialChanged || actualResourceChange
          ? "changed"
          : normalizeDocumentUrls(
                normalizeSingleDocument(
                  stripHistoricalMarkers(base),
                  before!.path,
                ),
                before!.path,
                context.beforeReader.generated.prefix,
                context.beforeReader.generated.routes,
              ) ===
              normalizeDocumentUrls(
                normalizeSingleDocument(
                  stripMarkers(head, after?.usage, headRanges),
                  after!.path,
                ),
                after!.path,
                context.afterReader.generated.prefix,
                context.afterReader.generated.routes,
              )
            ? "unchanged"
            : "ignored-only",
    },
    reasons,
  };
}

function normalizeOneSidedView(
  html: string,
  view: GeneratedComponentView,
  dialect: "current" | "historical",
): string {
  const ranges = view.usage
    ? validateComponentRanges(html, view.usage.ranges, dialect)
    : undefined;
  const material =
    dialect === "historical"
      ? stripHistoricalMarkers(html)
      : stripMarkers(html, view.usage, ranges);
  return normalizeSingleDocument(material, view.path);
}
