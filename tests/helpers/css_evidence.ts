import type {
  DependencyAnalysis,
  DependencyReason,
} from "../../packages/viewer/dist/data.js";

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
