/** Shared ownership-projected resource policy for fast and complete comparisons. */

import { parse } from "parse5";

import type { GeneratedComponentView } from "@mokly/viewer/data";

import {
  projectComponentPair,
  type ComponentProjection,
} from "../components/comparison_projection.js";
import {
  validateComponentRanges,
  type RenderedRange,
} from "../components/ranges.js";

import type { ComponentViewContext } from "./component_view.js";
import {
  attributeInlineRules,
  type InlineAttributionResult,
} from "./css/inline_attribution.js";
import {
  inlineMaterialReplacements,
  type InlineMaterialReplacements,
} from "./css/inline_rendering.js";
import { sameInlineOuterSources } from "./css/inline_styles.js";
import { normalizeHistoricalDocument, normalizeReviewPair } from "./ignore.js";

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
  matching: { before: string; after: string };
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
): PreparedComponentComparison {
  const baseRanges = before.usage
    ? validateComponentRanges(base, before.usage.ranges, "historical")
    : undefined;
  const headRanges = after.usage
    ? validateComponentRanges(head, after.usage.ranges)
    : undefined;
  const matching = normalizeReviewPair(
    normalizeHistoricalDocument(base),
    head,
    after.path,
  );
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
          },
          after: {
            source: head,
            sourceRanges: headRanges,
            usage: after.usage,
          },
          pairedIgnoreIds: matching.pairedIgnoreIds,
          ...(root ? { rootComponentId: root } : {}),
          parser: context.resources.css.parser,
          prepare: () => ({
            before: {
              document: parse(matching.base, { sourceCodeLocationInfo: true }),
              ranges: validateComponentRanges(
                matching.base,
                before.usage!.ranges,
              ),
            },
            after: {
              document: parse(matching.head, { sourceCodeLocationInfo: true }),
              ranges: validateComponentRanges(
                matching.head,
                after.usage!.ranges,
              ),
            },
          }),
        })
      : undefined;
  const inline = inlineMaterials(analysis);
  const projected = projectComponentPair(
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
    matching: { before: matching.base, after: matching.head },
    ownedComponentIds:
      analysis?.status === "resolved" ? analysis.ownedComponentIds : new Set(),
    ...(analysis ? { inlineAnalysis: analysis } : {}),
    ...inlineEvidence(analysis),
    excluded: projectedResourceExclusion(
      context,
      before,
      after,
      projected.pairedComponentIds,
      root,
    ),
  };
}

function inlineMaterials(analysis: InlineAttributionResult | undefined): {
  before: InlineMaterialReplacements;
  after: InlineMaterialReplacements;
} {
  const empty = {
    actual: { replacements: [], appendix: "" },
    projected: { replacements: [], appendix: "" },
  } as const;
  return analysis
    ? {
        before: inlineMaterialReplacements(analysis, "before"),
        after: inlineMaterialReplacements(analysis, "after"),
      }
    : { before: empty, after: empty };
}

function inlineEvidence(analysis: InlineAttributionResult | undefined): {
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
export function projectedResourceExclusion(
  context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
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
