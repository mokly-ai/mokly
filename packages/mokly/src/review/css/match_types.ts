/** Typed rule decisions and contained selector failures for CSS attribution. */
import type { CssRule, CssRuleDiffResult } from "./types.js";

/** Reduced potential impact of one stylesheet, or one diffed rule, on a view. */
export type CssAnalysisOutcome =
  | {
      kind: "kept";
      status: "matched" | "unresolved";
      selectors: readonly string[];
    }
  | { kind: "excluded" };

/** Both declaration sides remain available for changed custom properties and URLs. */
export type CssRuleDelta =
  | { kind: "added"; before?: never; after: CssRule }
  | { kind: "removed"; before: CssRule; after?: never }
  | { kind: "changed"; before: CssRule; after: CssRule };

/** A document decision retaining the exact diff material it explains. */
export interface CssRuleMatch {
  change: CssRuleDelta;
  outcome: CssAnalysisOutcome;
}

/** Resolved decisions follow added, removed, then changed diff-list order. */
export type CssRuleMatchResult =
  | { status: "resolved"; rules: readonly CssRuleMatch[] }
  | Extract<CssRuleDiffResult, { status: "unresolved" }>;

/** Internal selector failures are contained and become unresolved evidence. */
export class CssSelectorError extends Error {
  readonly code = "css-selector-unresolved";

  constructor(
    readonly kind: "selector-parse-failed" | "unresolved-nesting",
    cause?: unknown,
  ) {
    super("[mokly/review/css] selector matchability could not be resolved", {
      cause,
    });
    this.name = "CssSelectorError";
  }
}
