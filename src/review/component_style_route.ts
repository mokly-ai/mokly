/** Settle a proven single-style edit without constructing the base page tree. */
import type { ViewReview } from "@mokly/viewer/data";

import {
  componentUsageSignals,
  componentUsageTopologyEqual,
} from "../components/comparison_material.js";
import { extractCssReferences } from "../css_references.js";
import { documentWorkSync, timeSync } from "../diagnostics/timings.js";

import { prepareInlineEvidence } from "./component_projection_resources.js";
import type {
  ComparedComponentView,
  ComponentViewContext,
} from "./component_view.js";
import { deliveredInlineStyles } from "./component_view_material.js";
import { analyzeInlineRules } from "./css/inline_attribution.js";
import { prepareInlineRules } from "./css/inline_preparation.js";
import { inlineMaterialReplacements } from "./css/inline_rendering.js";
import type { InlineRunOccurrence } from "./css/inline_rule_runs.js";
import { cssRuleData } from "./css/rule_identity.js";
import { styleRouteRulesSafe } from "./css/style_route_rules.js";
import type { PageAnalysisPair } from "./page_pair.js";
import { insertedLinksFollowStyleWindow } from "./page_stylesheet_links.js";
import { unchangedPageResources } from "./page_quick_check.js";
import {
  changedStyleWindows,
  rawTextWindowSafe,
  styleWindowSpans,
} from "./style_windows.js";

export async function compareStyleOnlyView(
  context: ComponentViewContext,
  pages: PageAnalysisPair,
  view: ViewReview,
  root?: string,
): Promise<ComparedComponentView | undefined> {
  if (pages.links && pages.links.equalSource !== true) return;
  const { before, after, baseText, headText } = pages;
  // Condition 1: validation remains in the shared page analysis/full path.
  if (
    before.path !== after.path ||
    !before.usage ||
    !after.usage ||
    !componentUsageTopologyEqual(before.usage, after.usage)
  )
    return;
  const windows = changedStyleWindows(baseText, headText);
  if (!windows || !insertedLinksFollowStyleWindow(pages, windows)) return;
  const spans = styleWindowSpans(pages, windows);
  if (!spans) return;
  if (
    !rawTextWindowSafe(baseText, windows.before) ||
    !rawTextWindowSafe(headText, windows.after)
  )
    return;

  const head = pages.afterAnalysis;
  const paired = pages.pairedIgnoreIds;
  // The safe raw-text window leaves both sides with the same foreign structure.
  if (pages.links && head.foreignContentMayStayOpen(paired)) return;
  if (
    [...spans.before, ...spans.after].some(({ text }) => hasReviewPrefix(text))
  )
    return;
  const analysis = timeSync("review.inline-style-analysis", () => {
    const prepared = documentWorkSync("inlineRuleMs", () =>
      prepareInlineRules(
        spans.before,
        spans.after,
        context.resources.css.parser,
      ),
    );
    pages.inlinePreparation = prepared;
    if (!styleRouteRulesSafe(prepared)) return;
    return analyzeInlineRules({
      before: {
        source: baseText,
        sourceRanges: head.ranges,
        usage: before.usage!,
        spans: spans.before,
      },
      after: {
        source: headText,
        sourceRanges: head.ranges,
        usage: after.usage!,
        spans: spans.after,
      },
      pairedIgnoreIds: paired,
      rootComponentId: root,
      parser: context.resources.css.parser,
      prepared,
      prepare: () => {
        const matching = {
          document: head.matching(paired),
          ranges: head.ranges,
        };
        return { before: matching, after: matching };
      },
    });
  });
  if (!analysis || analysis.status !== "resolved") return;
  if (pages.inlinePreparation?.status === "resolved")
    pages.inlinePreparation = {
      ...pages.inlinePreparation,
      attributedChanges: new Map(
        analysis.rules
          .filter(({ change }) => change.kind !== "unchanged")
          .map((rule) => [rule.change, rule]),
      ),
    };
  const edited = spans.after.findIndex(
    (span) =>
      span.contentStart! <= windows.after.start &&
      windows.after.end <= span.contentEnd!,
  );
  const baseReferences = extractCssReferences(spans.before[edited]!.text);
  const headReferences = extractCssReferences(spans.after[edited]!.text);
  if (
    baseReferences.length !== headReferences.length ||
    baseReferences.some((value, index) => value !== headReferences[index])
  )
    return;
  // Condition 6 shares the identical-text quick check's raw seeds and closure policy.
  if (
    !(await unchangedPageResources(
      context,
      pages,
      ruleReferences(analysis.afterRuns),
    ))
  )
    return;

  const base = inlineMaterialReplacements(analysis, "before");
  const current = inlineMaterialReplacements(analysis, "after");
  if (
    [
      base.actual.appendix,
      base.projected.appendix,
      current.actual.appendix,
      current.projected.appendix,
    ].some(hasReviewPrefix)
  )
    return;
  const material = base.actual.appendix !== current.actual.appendix;
  const signals = componentUsageSignals(before.usage, after.usage);
  const reasons = [
    ...(base.projected.appendix !== current.projected.appendix
      ? [{ kind: "material" as const }]
      : []),
    ...(signals.inputs ? [{ kind: "inputs" as const }] : []),
    ...(signals.structure ? [{ kind: "structure" as const }] : []),
  ];
  const compared: ViewReview = {
    ...view,
    ignoredIds: [],
    state: material ? "changed" : "unchanged",
    ...(material ? { material: true } : {}),
  };
  const evidence = prepareInlineEvidence(analysis);
  return {
    comparisonPath: "style",
    view: {
      ...compared,
      ...deliveredInlineStyles(evidence.inlineEvidence, compared, reasons),
    },
    reasons,
    changedImplementations: analysis.ownedComponentIds,
    ownedResources: [],
    ...evidence,
  };
}

function* ruleReferences(
  runs: readonly InlineRunOccurrence[],
): Iterable<string> {
  for (const { run } of runs)
    for (const rule of run.rules) yield* cssRuleData(rule).references;
}

/** Condition 5 also guards serialization-produced and future reserved marker spellings. */
function hasReviewPrefix(text: string): boolean {
  return text.includes("<!--mokly-");
}
