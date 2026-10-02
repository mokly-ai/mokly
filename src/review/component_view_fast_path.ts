import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
  stripComponentMarkers,
  stripMarkers,
} from "../components/comparison_material.js";
import { mayContainCssReferences } from "../css_references.js";

import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import type { PageAnalysisPair } from "./page_pair.js";
import { identicalPageQuickCheck } from "./page_quick_check.js";

export interface UnchangedComponentAttempt {
  comparison?: ComparedComponentView;
  prepared?: PreparedComponentComparison;
}

/** Settle a paired view when neither its documents nor reachable resources can differ. */
export async function compareUnchangedComponentView(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  view: ViewReview,
  base: string,
  head: string,
  root?: string,
  pages?: PageAnalysisPair,
): Promise<UnchangedComponentAttempt> {
  if (before.path !== after.path) return {};
  if (
    pages &&
    base === head &&
    componentUsageTopologyEqual(before.usage, after.usage)
  ) {
    const comparison = await identicalPageQuickCheck(context, pages, view);
    return comparison ? { comparison } : {};
  }
  const retained = normalizeReviewPair(base, head, after.path);
  if (retained.base !== retained.head) return {};
  if (!componentUsageTopologyEqual(before.usage, after.usage)) return {};

  const strippedBase = stripMarkers(
    base,
    before.usage,
    pages?.beforeAnalysis.ranges,
  );
  const strippedHead = stripComponentMarkers(head);
  const actual = normalizeReviewPair(strippedBase, strippedHead, after.path);
  if (actual.base !== actual.head) return {};

  const hasOwnershipEdits = [before.usage, after.usage].some(
    (usage) =>
      usage &&
      (usage.instances.length > 0 ||
        usage.slots.some((slot) => slot.owner.kind === "entry")),
  );
  const hasInlineReferences = [base, head].some(mayContainCssReferences);
  const prepared =
    pages || hasOwnershipEdits || hasInlineReferences
      ? prepareComponentProjection(
          context,
          before,
          after,
          base,
          head,
          root,
          {
            analyzeInline: pages ? false : hasInlineReferences,
          },
          pages,
        )
      : undefined;
  const projected = prepared?.projected;
  const excluded = prepared?.excluded;
  const fallback = (): UnchangedComponentAttempt =>
    prepared && !pages ? { prepared } : {};
  if (projected && projected.before !== projected.after) return fallback();

  const afterResources = await context.afterReader.resources(
    after.path,
    actual.head,
    undefined,
    prepared?.references?.actualAfter,
  );
  const beforeResources = context.compareResourceBytes
    ? await context.beforeReader.resources(
        before.path,
        actual.base,
        undefined,
        prepared?.references?.actualBefore,
      )
    : afterResources;
  const projectedAfterResources =
    projected && excluded
      ? await context.afterReader.resources(
          after.path,
          projected.after,
          excluded,
          prepared?.references?.after,
        )
      : new Set<string>();
  const projectedBeforeResources =
    projected && excluded && context.compareResourceBytes
      ? await context.beforeReader.resources(
          before.path,
          projected.before,
          excluded,
          prepared?.references?.before,
        )
      : projectedAfterResources;
  const resources = new Set([
    ...beforeResources,
    ...afterResources,
    ...projectedBeforeResources,
    ...projectedAfterResources,
  ]);
  const repoPath = (route: string) =>
    context.prefix ? `${context.prefix}/${route}` : route;
  if ([...resources].some((route) => context.changed.has(repoPath(route))))
    return fallback();
  if (
    context.compareResourceBytes &&
    (
      await changedResourceBytes(
        beforeResources,
        afterResources,
        context.beforeReader,
        context.afterReader,
      )
    ).size > 0
  )
    return fallback();
  if (
    context.compareResourceBytes &&
    (
      await changedResourceBytes(
        projectedBeforeResources,
        projectedAfterResources,
        context.beforeReader,
        context.afterReader,
      )
    ).size > 0
  )
    return fallback();

  const signals = componentUsageSignals(before.usage, after.usage);
  const reasons = [
    ...(signals.inputs ? [{ kind: "inputs" as const }] : []),
    ...(signals.structure ? [{ kind: "structure" as const }] : []),
  ];
  const rawEqual =
    normalizeSingleDocument(strippedBase, after.path) ===
    normalizeSingleDocument(strippedHead, after.path);
  return {
    ...(prepared ? { prepared } : {}),
    comparison: {
      comparisonPath: "fast",
      view: {
        ...view,
        ignoredIds: actual.ignoredIds,
        state: rawEqual ? "unchanged" : "ignored-only",
      },
      reasons,
      changedImplementations: new Set(),
      ownedResources: [],
    },
  };
}
