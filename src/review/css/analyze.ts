/** Compose one rule diff and retain its matches for catalogue-wide attribution. */
import { timeSync } from "../../diagnostics/timings.js";

import { diffCssRules } from "./diff.js";
import type { CssDocumentPair } from "./document.js";
import { matchCssRules } from "./match.js";
import type {
  CssAnalysisOutcome,
  CssRuleDelta,
  CssRuleMatch,
  CssRuleMatchResult,
} from "./match_types.js";
import { LightningCssRuleParser } from "./rules.js";
import type { CssRuleDiffResult, CssRuleParser } from "./types.js";

/** No DOM proof is reduced away before the component and page tests can use it. */
export function analyzeStylesheetChange(
  before: string,
  after: string,
  documents: CssDocumentPair,
  parser: CssRuleParser = new LightningCssRuleParser(),
  matcher: typeof matchCssRules = matchCssRules,
): CssAnalysisOutcome {
  return timeSync("review.css-analysis", () => {
    const diff = diffCssRules(before, after, parser);
    let matched: CssRuleMatchResult;
    try {
      matched = matcher(diff, documents);
    } catch {
      matched =
        diff.status === "unresolved"
          ? diff
          : { status: "resolved", rules: unresolvedRules(diff) };
      if (matched.status === "resolved" && !matched.rules.length)
        return { kind: "kept", status: "unresolved", selectors: [], rules: [] };
    }
    if (matched.status === "unresolved")
      return { kind: "kept", status: "unresolved", selectors: [], rules: [] };
    const kept = matched.rules.flatMap(({ outcome }) =>
      outcome.kind === "kept" ? [outcome] : [],
    );
    if (!kept.length) return { kind: "excluded" };
    return {
      kind: "kept",
      status: kept.some((outcome) => outcome.status === "unresolved")
        ? "unresolved"
        : "matched",
      selectors: [
        ...new Set(kept.flatMap((outcome) => outcome.selectors)),
      ].sort(),
      rules: matched.rules,
    };
  });
}

function unresolvedRules(
  diff: Extract<CssRuleDiffResult, { status: "resolved" }>,
): CssRuleMatch[] {
  const changes: CssRuleDelta[] = [
    ...diff.added.map((after) => ({ kind: "added" as const, after })),
    ...diff.removed.map((before) => ({ kind: "removed" as const, before })),
    ...diff.changed.map((change) => ({ kind: "changed" as const, ...change })),
  ];
  return changes.map((change) => ({
    change,
    matches: [],
    outcome: {
      kind: "kept",
      status: "unresolved",
      selectors: [
        ...new Set(
          [change.before, change.after].flatMap(
            (rule) => rule?.selectors ?? [],
          ),
        ),
      ].sort(),
    },
  }));
}
