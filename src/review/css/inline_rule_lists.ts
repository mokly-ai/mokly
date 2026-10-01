/** Parse independent inline stylesheets into one ordered rule list per side. */
import { flattenInlineRules, parseInlineRuns } from "./inline_rule_runs.js";
import type { InlineStyleSpan } from "./inline_styles.js";
import type { CssRuleParser, CssRuleParseResult } from "./types.js";

/** Parse each element separately and rebase local ordinals monotonically. */
export function parseInlineRuleList(
  spans: readonly InlineStyleSpan[],
  parser: CssRuleParser,
): CssRuleParseResult {
  const parsed = parseInlineRuns(spans, parser);
  return parsed.status === "unresolved"
    ? parsed
    : { status: "parsed", rules: flattenInlineRules(parsed.occurrences) };
}
