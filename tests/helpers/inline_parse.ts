/** Test-only whole-list assembly adapter for the captured M4 engine and parser oracles. */
import {
  flattenInlineRules,
  parseInlineRuns,
} from "../../src/review/css/inline_rule_runs.js";
import type { InlineStyleSpan } from "../../src/review/css/inline_styles.js";
import { rebaseCssRule } from "../../src/review/css/rule_identity.js";
import type {
  CssInlineParseResult,
  CssRuleParser,
  CssRuleParseResult,
} from "../../src/review/css/types.js";

export function assembleInlineParse(
  result: CssInlineParseResult,
  ordinalBase = 0,
): CssRuleParseResult {
  if (result.status !== "segmented") return result;
  let ordinal = ordinalBase;
  return {
    status: "parsed",
    rules: result.runs.flatMap((run) =>
      run.rules.map((rule) => rebaseCssRule(rule, ordinal++)),
    ),
  };
}

export function parseInlineRuleList(
  spans: readonly InlineStyleSpan[],
  parser: CssRuleParser,
): CssRuleParseResult {
  const result = parseInlineRuns(spans, parser);
  return result.status === "parsed"
    ? { status: "parsed", rules: flattenInlineRules(result.occurrences) }
    : result;
}
