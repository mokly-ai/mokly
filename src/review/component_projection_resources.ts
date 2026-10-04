/** Shared ownership-projected resource policy for fast and complete comparisons. */

import type { GeneratedComponentView } from "@mokly/viewer/data";

import {
  projectComponentPair,
  type ComponentProjection,
} from "../components/comparison_projection.js";
import {
  validateComponentRanges,
  type RenderedRange,
} from "../components/ranges.js";
import { parseHtml } from "../diagnostics/html_parse.js";

import type { ComponentViewContext } from "./component_view.js";
import type { CssDocument } from "./css/document.js";
import {
  attributeInlineRules,
  type InlineAttributionResult,
} from "./css/inline_attribution.js";
import { sameInlineOuterSources } from "./css/inline_styles.js";
import { normalizeReviewPair } from "./ignore.js";
import { pageInlineMaterials } from "./page_inline_material.js";
import { PageAnalysisPair } from "./page_pair.js";
import {
  projectAnalyzedPair,
  type ProjectedReferences,
} from "./page_projection.js";

export interface PreparedInlineStyleEvidence {
  allExcluded: boolean;
  retainedSelectors?: {
    status: "matched" | "unresolved";
    selectors: readonly string[];
  };
}

/** Projection material prepared once and shared by fast and complete comparison. */
export interface PreparedComponentComparison {
  baseRanges?: readonly RenderedRange[];
  headRanges?: readonly RenderedRange[];
  projected: ComponentProjection;
  excluded: (path: string) => boolean;
  matching: { before: string | CssDocument; after: string | CssDocument };
  references?: ProjectedReferences;
  ownedComponentIds: ReadonlySet<string>;
  inlineAnalysis?: InlineAttributionResult;
  inlineEvidence?: PreparedInlineStyleEvidence;
}

interface ProjectionPreparationOptions {
  analyzeInline?: boolean;
}

/** Validate ranges, project ownership, and bind the matching resource policy. */
export function prepareComponentProjection(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  base: string,
  head: string,
  root?: string,
  options: ProjectionPreparationOptions = {},
  pages?: PageAnalysisPair,
): PreparedComponentComparison {
  pages ??= context.componentAware
    ? new PageAnalysisPair(before, after, base, head)
    : undefined;
  const baseRanges = pages
    ? pages.beforeAnalysis.ranges
    : before.usage
      ? validateComponentRanges(base, before.usage.ranges)
      : undefined;
  const headRanges = pages
    ? pages.afterAnalysis.ranges
    : after.usage
      ? validateComponentRanges(head, after.usage.ranges)
      : undefined;
  const matching = pages
    ? undefined
    : normalizeReviewPair(base, head, after.path);
  const paired = pages?.pairedIgnoreIds ?? matching!.pairedIgnoreIds;
  const analysis =
    options.analyzeInline !== false &&
    before.usage &&
    after.usage &&
    baseRanges &&
    headRanges
      ? attributeInlineRules({
          before: {
            source: base,
            sourceRanges: baseRanges,
            usage: before.usage,
            ...(pages
              ? { spans: pages.beforeAnalysis.inlineStyles(paired) }
              : {}),
          },
          after: {
            source: head,
            sourceRanges: headRanges,
            usage: after.usage,
            ...(pages
              ? { spans: pages.afterAnalysis.inlineStyles(paired) }
              : {}),
          },
          pairedIgnoreIds: paired,
          ...(root ? { rootComponentId: root } : {}),
          parser: context.resources.css.parser,
          ...(pages?.inlinePreparation
            ? { prepared: pages.inlinePreparation }
            : {}),
          prepare: () => ({
            before: {
              document:
                pages?.beforeAnalysis.matching(paired) ??
                parseHtml("inlineMatching", matching!.base, {
                  sourceCodeLocationInfo: true,
                }),
              ranges:
                pages?.beforeAnalysis.ranges ??
                validateComponentRanges(matching!.base, before.usage!.ranges),
            },
            after: {
              document:
                pages?.afterAnalysis.matching(paired) ??
                parseHtml("inlineMatching", matching!.head, {
                  sourceCodeLocationInfo: true,
                }),
              ranges:
                pages?.afterAnalysis.ranges ??
                validateComponentRanges(matching!.head, after.usage!.ranges),
            },
          }),
        })
      : undefined;
  const inline = pageInlineMaterials(
    analysis,
    base,
    head,
    context.useMaterialFingerprints !== false,
    pages,
  );
  const analyzedProjection = pages
    ? projectAnalyzedPair(pages, inline)
    : undefined;
  const projected =
    analyzedProjection?.projected ??
    projectComponentPair(
      base,
      head,
      before.usage,
      after.usage,
      after.path,
      root,
      inline,
      baseRanges,
      headRanges,
    );
  return {
    ...(baseRanges ? { baseRanges } : {}),
    ...(headRanges ? { headRanges } : {}),
    projected,
    matching: {
      before: pages?.beforeAnalysis.matching(paired) ?? matching!.base,
      after: pages?.afterAnalysis.matching(paired) ?? matching!.head,
    },
    ...(analyzedProjection
      ? { references: analyzedProjection.references }
      : {}),
    ownedComponentIds:
      analysis?.status === "resolved" ? analysis.ownedComponentIds : new Set(),
    ...(analysis ? { inlineAnalysis: analysis } : {}),
    ...prepareInlineEvidence(analysis),
    excluded:
      pages?.resourceExclusion(() =>
        projectedResourceExclusion(context, projected.pairedComponentIds, root),
      ) ??
      projectedResourceExclusion(context, projected.pairedComponentIds, root),
  };
}

export function prepareInlineEvidence(
  analysis: InlineAttributionResult | undefined,
): {
  inlineEvidence?: PreparedInlineStyleEvidence;
} {
  if (!analysis || analysis.status === "skipped") return {};
  if (
    analysis.status === "unresolved" &&
    sameInlineOuterSources(analysis.beforeSpans, analysis.afterSpans)
  )
    return {};
  if (analysis.status === "unresolved")
    return {
      inlineEvidence: {
        allExcluded: false,
        retainedSelectors: analysis.retainedSelectors,
      },
    };
  const diffed = analysis.rules.filter(
    ({ change }) => change.kind !== "unchanged",
  );
  if (!diffed.length) return {};
  return {
    inlineEvidence: {
      allExcluded: diffed.every(
        ({ attribution }) => attribution.kind === "excluded",
      ),
      ...(analysis.retainedSelectors
        ? { retainedSelectors: analysis.retainedSelectors }
        : {}),
    },
  };
}

/** Build the exact projected-resource exclusion used by complete comparison. */
function projectedResourceExclusion(
  context: ComponentViewContext,
  pairedComponentIds: ReadonlySet<string>,
  root: string | undefined,
): (path: string) => boolean {
  const repoPath = (path: string) =>
    context.prefix ? `${context.prefix}/${path}` : path;
  return (path: string) =>
    context.dependencies.suppressResource(
      repoPath(path),
      pairedComponentIds,
      root,
    );
}
