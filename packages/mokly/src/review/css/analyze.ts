/** Compose rule diffing, matching, and conservative reduction for one stylesheet. */
import { timeSync } from "../../diagnostics/timings.js";

import { diffCssRules } from "./diff.js";
import type { CssDocumentPair } from "./document.js";
import { matchCssRules } from "./match.js";
import type { CssAnalysisOutcome } from "./match_types.js";
import { LightningCssRuleParser } from "./rules.js";
import type { CssRuleParser } from "./types.js";

/** The shared, standalone parser/diff/match entry point for one stylesheet on one view. */
export function analyzeStylesheetChange(
  before: string,
  after: string,
  documents: CssDocumentPair,
  parser: CssRuleParser = new LightningCssRuleParser(),
  matcher: typeof matchCssRules = matchCssRules,
): CssAnalysisOutcome {
  return timeSync("review.css-analysis", () => {
    const matched = matcher(diffCssRules(before, after, parser), documents);
    if (matched.status === "unresolved")
      return { kind: "kept", status: "unresolved", selectors: [] };
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
    };
  });
}
