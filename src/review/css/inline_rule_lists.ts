/** Parse independent inline stylesheets into one ordered rule list per side. */
import { parseCssRules } from "./diff.js";
import type { InlineStyleSpan } from "./inline_styles.js";
import type { CssRule, CssRuleParser, CssRuleParseResult } from "./types.js";

/** Parse each element separately and rebase local ordinals monotonically. */
export function parseInlineRuleList(
  spans: readonly InlineStyleSpan[],
  parser: CssRuleParser,
): CssRuleParseResult {
  const rules: CssRule[] = [];
  for (const span of spans) {
    const parsed = parseCssRules(parser, span.text);
    if (parsed.status === "unresolved") return parsed;
    for (const rule of [...parsed.rules].sort((a, b) => a.ordinal - b.ordinal))
      rules.push({ ...rule, ordinal: rules.length });
  }
  return { status: "parsed", rules };
}
