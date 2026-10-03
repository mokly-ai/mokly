import type { ComponentViewRecord } from "@mokly/viewer";
import type {
  GeneratedComponentView,
  EntryChangeReason,
  ViewReview,
} from "@mokly/viewer/data";

import { stripMarkers } from "../components/comparison_material.js";
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
import type { ReviewLinkNormalization } from "./ignore.js";
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
  links?: (beforeRoute: string, afterRoute: string) => ReviewLinkNormalization;
  beforeUsage?: (usage: ComponentViewRecord) => ComponentViewRecord;
}
/** Compare material and declared inputs without altering the retained view documents. */
export async function compareComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView | undefined,
  after: GeneratedComponentView | undefined,
  root?: string,
): Promise<ComparedComponentView> {
  if (before?.usage && context.beforeUsage)
    before = { ...before, usage: context.beforeUsage(before.usage) };
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
    state: before ? "removed" : "added",
  };
  if (base === undefined || head === undefined) {
    const normalized =
      base !== undefined
        ? normalizeOneSidedView(base, before!)
        : normalizeOneSidedView(head!, after!);
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
  if (projected.before !== projected.after) reasons.push({ kind: "material" });
  if (projected.inputs) reasons.push({ kind: "inputs" });
  if (projected.structure) reasons.push({ kind: "structure" });
  const actual = normalizeReviewPair(
    stripMarkers(base, before?.usage, baseRanges),
    stripMarkers(head, after?.usage, headRanges),
    selected.path,
    context.links?.(before!.path, after!.path),
  );
  const resourceBefore = projected.resourceBefore ?? projected.before;
  const resourceAfter = projected.resourceAfter ?? projected.after;
  const actualBefore = actual.resourceBase ?? actual.base;
  const actualAfter = actual.resourceHead ?? actual.head;
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  const evidence = await context.resources.compare(
    { path: before!.path, html: resourceBefore },
    { path: after!.path, html: resourceAfter },
    excluded,
    { before: actualBefore, after: actualAfter },
  );
  reasons.push(...(evidence.reasons ?? []));
  const actualEvidence = await context.resources.compare(
    { path: before!.path, html: actualBefore },
    { path: after!.path, html: actualAfter },
  );
  const byteChanges = context.compareResourceBytes
    ? await changedResourceBytes(
        await context.beforeReader.resources(
          before!.path,
          resourceBefore,
          excluded,
        ),
        await context.afterReader.resources(
          after!.path,
          resourceAfter,
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
        await context.beforeReader.resources(before!.path, actualBefore),
        await context.afterReader.resources(after!.path, actualAfter),
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
      context.links?.(before!.path, after!.path),
    ),
    view: {
      ...view,
      ...actualEvidence,
      ignoredIds: actual.ignoredIds,
      ...(actual.base !== actual.head ? { material: true as const } : {}),
      state:
        actual.base !== actual.head || actualResourceChange
          ? "changed"
          : projected.rawEqual
            ? "unchanged"
            : "ignored-only",
    },
    reasons,
  };
}

function normalizeOneSidedView(
  html: string,
  view: GeneratedComponentView,
): string {
  const ranges = view.usage
    ? validateComponentRanges(html, view.usage.ranges)
    : undefined;
  const material = stripMarkers(html, view.usage, ranges);
  return normalizeSingleDocument(material, view.path);
}
