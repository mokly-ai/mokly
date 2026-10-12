/** View-wide parsing and cancellation shared by the style route and full attribution. */
import { mayContainCssReferences } from "../../css_references.js";

import type { diffCssRuleLists } from "./diff.js";
import type { AttributedInlineRule } from "./inline_rule_matching.js";
import {
  parseInlineRuns,
  type InlineRunOccurrence,
} from "./inline_rule_runs.js";
import { inlineSegmentChanges } from "./inline_segment_changes.js";
import {
  sameInlineOuterSources,
  type InlineStyleSpan,
} from "./inline_styles.js";
import type { CssRuleDelta } from "./match_types.js";
import type { CssRuleDiffResult, CssRuleParser } from "./types.js";

export type PreparedInlineRules =
  | { status: "skipped" }
  | {
      status: "unresolved";
      failures: Extract<
        CssRuleDiffResult,
        { status: "unresolved" }
      >["failures"];
      retainedSelectors: { status: "unresolved"; selectors: readonly [] };
    }
  | {
      status: "resolved";
      beforeRuns: readonly InlineRunOccurrence[];
      afterRuns: readonly InlineRunOccurrence[];
      deltas: readonly CssRuleDelta[];
      /** Diff attribution proven safe in this view pair; unchanged references still use both trees. */
      attributedChanges?: ReadonlyMap<CssRuleDelta, AttributedInlineRule>;
    };

export function prepareInlineRules(
  beforeSpans: readonly InlineStyleSpan[],
  afterSpans: readonly InlineStyleSpan[],
  parser: CssRuleParser,
  diffRules?: typeof diffCssRuleLists,
): PreparedInlineRules {
  const outerSourcesEqual = sameInlineOuterSources(beforeSpans, afterSpans);
  if (
    outerSourcesEqual &&
    ![...beforeSpans, ...afterSpans].some((span) =>
      mayContainCssReferences(span.text),
    )
  )
    return { status: "skipped" };
  const before = parseInlineRuns(beforeSpans, parser);
  const after = parseInlineRuns(afterSpans, parser);
  if (before.status === "unresolved" || after.status === "unresolved")
    return {
      status: "unresolved",
      failures: [
        ...(before.status === "unresolved"
          ? [{ side: "before" as const, error: before.error }]
          : []),
        ...(after.status === "unresolved"
          ? [{ side: "after" as const, error: after.error }]
          : []),
      ],
      retainedSelectors: { status: "unresolved", selectors: [] },
    };
  const { deltas } = inlineSegmentChanges(before, after, diffRules);
  if (!deltas.length && outerSourcesEqual) return { status: "skipped" };
  return {
    status: "resolved",
    beforeRuns: before.occurrences,
    afterRuns: after.occurrences,
    deltas,
  };
}
