import type { GeneratedComponentView, ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
  stripComponentMarkers,
  stripMarkers,
} from "../components/comparison_material.js";
import { materialRecipe } from "../components/material_recipe.js";
import { mayContainCssReferences } from "../css_references.js";

import {
  prepareComponentProjection,
  type PreparedComponentComparison,
} from "./component_projection_resources.js";
import { changedResourceBytes } from "./component_resource_changes.js";
import { insertedStylesheetResources } from "./component_stylesheet_resources.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view_types.js";
import {
  sameInlineOuterSources,
  type InlineStyleSpan,
} from "./css/inline_styles.js";
import { normalizeReviewPair, normalizeSingleDocument } from "./ignore.js";
import type { PageAnalysisPair } from "./page_pair.js";
import { identicalPageQuickCheck } from "./page_quick_check.js";
import { insertedComparisonSource } from "./page_stylesheet_links.js";
import { styleNeedsFullValidation } from "./style_source_safety.js";

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
  const links = context.links?.(before.path, after.path);
  if (
    pages &&
    (!pages.links || pages.links.equalSource === true) &&
    base === head &&
    componentUsageTopologyEqual(before.usage, after.usage)
  ) {
    const comparison = await identicalPageQuickCheck(context, pages, view);
    return comparison ? { comparison } : {};
  }
  const rootOnly =
    Boolean(pages) &&
    [before.usage, after.usage].every(
      (usage) =>
        usage &&
        usage.instances.length === 0 &&
        usage.slots.length === 0 &&
        usage.ranges.length === 1 &&
        usage.ranges[0]!.target.kind === "root",
    );
  const comparisonSource = (source: string, usage: typeof before.usage) => {
    const material = insertedComparisonSource(source, usage, root);
    return rootOnly ? stripComponentMarkers(material) : material;
  };
  const baseSource = comparisonSource(base, before.usage);
  const headSource = comparisonSource(head, after.usage);
  const retained =
    pages?.normalize(baseSource, headSource) ??
    normalizeReviewPair(baseSource, headSource, after.path, links);
  if (retained.base !== retained.head) return {};
  if (!componentUsageTopologyEqual(before.usage, after.usage)) return {};
  const baseStylesheets = insertedStylesheetResources(
    base,
    before.usage,
    before.path,
    pages?.beforeAnalysis.document,
  );
  const headStylesheets = insertedStylesheetResources(
    head,
    after.usage,
    after.path,
    pages?.afterAnalysis.document,
  );
  let safeStyles: readonly InlineStyleSpan[] | undefined;
  if (pages) {
    const paired = pages.pairedIgnoreIds;
    const baseStyles = pages.beforeAnalysis.inlineStyles(paired);
    const headStyles = pages.afterAnalysis.inlineStyles(paired);
    if (!sameInlineOuterSources(baseStyles, headStyles)) return {};
    for (const side of [pages.beforeAnalysis, pages.afterAnalysis])
      if (
        side.inlineStyles(paired).some(styleNeedsFullValidation) ||
        side.hasDroppedStyleReferences(paired)
      )
        return {};
    safeStyles = headStyles;
  }
  const fallback = (
    prepared?: PreparedComponentComparison,
  ): UnchangedComponentAttempt => {
    if (
      pages &&
      safeStyles &&
      context.useMaterialFingerprints !== false &&
      context.useFastPath !== false &&
      context.useStylePath !== false
    )
      pages.rememberStyleSafety(safeStyles);
    return prepared && !pages ? { prepared } : {};
  };

  const strippedBase = stripMarkers(
    baseSource,
    before.usage,
    pages?.beforeAnalysis.ranges,
  );
  const strippedHead = stripComponentMarkers(headSource);
  const actual =
    strippedBase === baseSource && strippedHead === headSource
      ? retained
      : (pages?.normalize(strippedBase, strippedHead) ??
        normalizeReviewPair(strippedBase, strippedHead, after.path, links));
  if (actual.base !== actual.head) return fallback();

  const hasOwnershipEdits = [before.usage, after.usage].some(
    (usage) =>
      usage &&
      (usage.instances.length > 0 ||
        (!pages &&
          usage.ranges.some((range) => range.target.kind === "root")) ||
        usage.slots.some((slot) => slot.owner.kind === "entry")),
  );
  const hasInlineReferences = [base, head].some(mayContainCssReferences);
  const prepared = (
    pages ? hasOwnershipEdits : hasOwnershipEdits || hasInlineReferences
  )
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
  const empty = { replacements: [], appendix: "" };
  const actualBefore =
    prepared?.references?.actualBefore ??
    pages?.beforeAnalysis.materialReferences(
      materialRecipe(base, empty),
      pages.pairedIgnoreIds,
    );
  const actualAfter =
    prepared?.references?.actualAfter ??
    pages?.afterAnalysis.materialReferences(
      materialRecipe(head, empty),
      pages.pairedIgnoreIds,
    );
  if (projected && projected.before !== projected.after)
    return fallback(prepared);

  const afterResources = await context.afterReader.resources(
    after.path,
    actual.resourceHead ?? actual.head,
    undefined,
    { references: actualAfter, insertedStylesheets: headStylesheets },
  );
  const beforeResources = await context.beforeReader.resourcesIfPresent(
    before.path,
    actual.resourceBase ?? actual.base,
    undefined,
    { references: actualBefore, insertedStylesheets: baseStylesheets },
  );
  if (!beforeResources) return fallback(prepared);
  const projectedAfterResources =
    projected && excluded
      ? await context.afterReader.resources(
          after.path,
          projected.resourceAfter ?? projected.after,
          excluded,
          {
            references: prepared?.references?.after,
          },
        )
      : new Set<string>();
  const projectedBeforeResources =
    projected && excluded
      ? await context.beforeReader.resourcesIfPresent(
          before.path,
          projected.resourceBefore ?? projected.before,
          excluded,
          {
            references: prepared?.references?.before,
          },
        )
      : projectedAfterResources;
  if (!projectedBeforeResources) return fallback(prepared);
  const resources = new Set([
    ...beforeResources,
    ...afterResources,
    ...projectedBeforeResources,
    ...projectedAfterResources,
  ]);
  const repoPath = (route: string) =>
    context.prefix ? `${context.prefix}/${route}` : route;
  if ([...resources].some((route) => context.changed.has(repoPath(route))))
    return fallback(prepared);
  if (
    (
      await changedResourceBytes(
        beforeResources,
        afterResources,
        context.beforeReader,
        context.afterReader,
        context.resourceIdentity,
      )
    ).size > 0
  )
    return fallback(prepared);
  if (
    (
      await changedResourceBytes(
        projectedBeforeResources,
        projectedAfterResources,
        context.beforeReader,
        context.afterReader,
        context.resourceIdentity,
      )
    ).size > 0
  )
    return fallback(prepared);

  const signals = componentUsageSignals(before.usage, after.usage);
  const reasons = [
    ...(signals.inputs ? [{ kind: "inputs" as const }] : []),
    ...(signals.structure ? [{ kind: "structure" as const }] : []),
  ];
  const rawEqual =
    normalizeSingleDocument(strippedBase, after.path, links?.before) ===
    normalizeSingleDocument(strippedHead, after.path, links?.after);
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
