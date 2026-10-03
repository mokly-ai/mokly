import type { CssRuleAttribution, DependencyAnalysis } from "../types.js";

const union = (values: readonly string[]) => [...new Set(values)].sort();

/** Build the summary only from the retained rule facts. */
export function cssAnalysis(
  rules: readonly CssRuleAttribution[],
): DependencyAnalysis {
  const unresolved = rules.some((rule) => rule.status === "unresolved");
  const pageSelectors = union(rules.flatMap((rule) => rule.pageSelectors));
  return {
    status: unresolved ? "unresolved" : "matched",
    selectors: union(rules.flatMap((rule) => rule.selectors)),
    rules,
    ...(unresolved || pageSelectors.length
      ? {
          pageEvidence: {
            selectors: pageSelectors,
            ...(unresolved ? { unresolved: true as const } : {}),
          },
        }
      : {}),
  };
}

/** Merge one path across views without turning component selectors into page matches. */
export function mergeCssAnalysis(
  analyses: readonly DependencyAnalysis[],
): DependencyAnalysis {
  const merged = new Map<string, CssRuleAttribution>();
  for (const rule of analyses.flatMap((analysis) => analysis.rules)) {
    const key = rule.ruleKey ?? "~";
    const previous = merged.get(key);
    merged.set(
      key,
      previous
        ? {
            ...(rule.ruleKey ? { ruleKey: rule.ruleKey } : {}),
            status:
              rule.status === "unresolved" || previous.status === "unresolved"
                ? "unresolved"
                : "matched",
            selectors: union([...previous.selectors, ...rule.selectors]),
            changedComponentIds: union([
              ...previous.changedComponentIds,
              ...rule.changedComponentIds,
            ]),
            pageSelectors: union([
              ...previous.pageSelectors,
              ...rule.pageSelectors,
            ]),
          }
        : rule,
    );
  }
  return cssAnalysis(
    [...merged]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, rule]) => rule),
  );
}
