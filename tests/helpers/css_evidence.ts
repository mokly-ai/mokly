import type {
  CssRuleAttribution,
  DependencyAnalysis,
  DependencyReason,
} from "../../packages/viewer/dist/data.js";
import { cssAnalysis } from "../../packages/viewer/dist/review/css/evidence.js";

/** Synthetic wire evidence for reader and presentation fixtures, never product data. */
export function fixtureCssAnalysis(
  status: "matched" | "unresolved",
  selectors: readonly string[],
): DependencyAnalysis {
  const ordered = [...new Set(selectors)].sort();
  return {
    status,
    selectors: ordered,
    rules: [
      {
        ...(ordered.length || status === "matched"
          ? { ruleKey: "a".repeat(64) }
          : {}),
        status,
        selectors: ordered,
        changedComponentIds: [],
        pageSelectors: status === "matched" ? ordered : [],
      },
    ],
    pageEvidence: {
      selectors: status === "matched" ? ordered : [],
      ...(status === "unresolved" ? { unresolved: true } : {}),
    },
  };
}

/** Existing summary assertions remain separate from the rule-proof regression suites. */
export function cssSummary(analysis: DependencyAnalysis | undefined) {
  return analysis && { status: analysis.status, selectors: analysis.selectors };
}

export function resourceReasonSummaries(
  reasons: readonly DependencyReason[] | undefined,
) {
  return reasons?.map((reason) => ({
    ...reason,
    ...(reason.analysis ? { analysis: cssSummary(reason.analysis) } : {}),
  }));
}

/** One synthetic changed rule; omitted arrays are empty and the key is fixed. */
export function cssRule(
  rule: Partial<CssRuleAttribution> & Pick<CssRuleAttribution, "selectors">,
): CssRuleAttribution {
  return {
    ruleKey: "b".repeat(64),
    status: "matched",
    changedComponentIds: [],
    pageSelectors: [],
    ...rule,
  };
}

/** A stylesheet reason whose summary the product derives from its rules. */
export function cssReason(
  path: string,
  rules: readonly CssRuleAttribution[],
): DependencyReason {
  return { kind: "dependency", path, analysis: cssAnalysis(rules) };
}
