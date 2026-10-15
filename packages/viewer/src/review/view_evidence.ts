/**
 * Present the entry detail's review v8 evidence records through the shell's
 * file and selector derivation. A file is a rule's stylesheet or a resource's
 * path; a page selector is a matched rule the entry owns; a component selector
 * names its owning component; a stylesheet whose rules are all excluded is an
 * excluded file.
 */

import type { RuleEvidence, ViewEvidence } from "../catalogue/types.js";

import { cssAnalysis } from "./css/evidence.js";
import type {
  CssRuleAttribution,
  DependencyReason,
  ExcludedResource,
  ResourceEvidence,
} from "./types.js";

const union = (values: readonly string[]) => [...new Set(values)].sort();

/** The reasons and exclusions one view's or page's records prove. */
export function viewEvidenceReasons(evidence: ViewEvidence): ResourceEvidence {
  const sheets = new Map<string, RuleEvidence[]>();
  for (const rule of evidence.rules) {
    const known = sheets.get(rule.stylesheet) ?? [];
    known.push(rule);
    sheets.set(rule.stylesheet, known);
  }
  const reasons: DependencyReason[] = [];
  const excludedResources: ExcludedResource[] = [];
  for (const [path, rules] of [...sheets].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const retained = rules.filter((rule) => rule.status !== "excluded");
    if (!retained.length) {
      excludedResources.push({ path, reason: "no-matching-rule" });
      continue;
    }
    reasons.push({
      kind: "dependency",
      path,
      analysis: cssAnalysis(attributions(retained)),
    });
  }
  for (const path of union(evidence.resources.map((item) => item.path)))
    if (!sheets.has(path)) reasons.push({ kind: "dependency", path });
  return {
    ...(reasons.length ? { reasons } : {}),
    ...(excludedResources.length ? { excludedResources } : {}),
  };
}

/** One attribution per selector, keyed so views merge by selector. */
function attributions(rules: readonly RuleEvidence[]): CssRuleAttribution[] {
  const bySelector = new Map<string, RuleEvidence[]>();
  for (const rule of rules) {
    const known = bySelector.get(rule.selector) ?? [];
    known.push(rule);
    bySelector.set(rule.selector, known);
  }
  return [...bySelector]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([selector, records]) => {
      const unresolved = records.some((rule) => rule.status === "unresolved");
      const pageMatch = records.some(
        (rule) => rule.owner.kind === "entry" && rule.status === "matched",
      );
      return {
        ruleKey: `selector:${selector}`,
        status: unresolved ? "unresolved" : "matched",
        selectors: selector ? [selector] : [],
        changedComponentPaths: union(
          records.flatMap((rule) =>
            rule.owner.kind === "component" ? [rule.owner.path] : [],
          ),
        ),
        pageSelectors: pageMatch && selector ? [selector] : [],
      };
    });
}
