/** Shared ownership-projected resource policy for fast and complete comparisons. */
import type { GeneratedComponentView } from "@mokly/viewer/data";

import {
  validateComponentRanges,
  type RenderedRange,
} from "../../../dist/components/ranges.js";
import { parseHtml } from "../../../dist/diagnostics/html_parse.js";
import {
  applyInlineMaterial,
  inlineMaterialReplacements,
  type InlineMaterialReplacements,
} from "../../../dist/review/css/inline_rendering.js";
import { normalizeReviewPair } from "../../../dist/review/ignore.js";
import { PageAnalysis } from "../../../dist/review/page_analysis.js";
import { projectedResourceExclusion as recordedResourceExclusion } from "../../../src/review/component_resource_exclusion.js";

import {
  projectComponentPair,
  type ComponentProjection,
} from "./comparison_projection.js";
import type { ComponentViewContext } from "./component_view.js";
import {
  attributeInlineRules,
  type InlineAttributionResult,
} from "./inline_attribution.js";
import { sameInlineOuterSources } from "./inline_styles.js";

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
  const basePage = new PageAnalysis(base, before.path, before.usage);
  const headPage = new PageAnalysis(head, after.path, after.usage);
  const originalBaseRanges = before.usage ? basePage.ranges : undefined;
  const originalHeadRanges = after.usage ? headPage.ranges : undefined;
  base = applyInlineMaterial(base, {
    replacements: basePage.stylesheetEdits(root),
    appendix: "",
  });
  head = applyInlineMaterial(head, {
    replacements: headPage.stylesheetEdits(root),
    appendix: "",
  });
  const baseRanges = before.usage
    ? validateComponentRanges(base, before.usage.ranges)
    : undefined;
  const headRanges = after.usage
    ? validateComponentRanges(head, after.usage.ranges)
    : undefined;
  const matching = normalizeReviewPair(base, head, after.path);
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
              document: parseHtml("inlineMatching", matching.base, {
                sourceCodeLocationInfo: true,
              }),
              ranges: validateComponentRanges(
                matching.base,
                before.usage!.ranges,
              ),
            },
            after: {
              document: parseHtml("inlineMatching", matching.head, {
                sourceCodeLocationInfo: true,
              }),
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
    ...(originalBaseRanges ? { baseRanges: originalBaseRanges } : {}),
    ...(originalHeadRanges ? { headRanges: originalHeadRanges } : {}),
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
function projectedResourceExclusion(
  _context: ComponentViewContext,
  before: GeneratedComponentView,
  after: GeneratedComponentView,
  pairedComponentIds: ReadonlySet<string>,
  root: string | undefined,
): (path: string) => boolean {
  return recordedResourceExclusion(before, after, pairedComponentIds, root);
}
