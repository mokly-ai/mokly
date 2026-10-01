/** Parse independent inline stylesheets into one ordered rule list per side. */
import { parseCssRules } from "./diff.js";
import type { InlineStyleSpan } from "./inline_styles.js";
import { rebaseCssRule } from "./rule_identity.js";
import { CssSegmentAnalysis } from "./segment_analysis.js";
import type { CssRule, CssRuleParser, CssRuleParseResult } from "./types.js";

const inlineParsers = new WeakMap<CssRuleParser, CssSegmentAnalysis>();

/** Parse each element separately and rebase local ordinals monotonically. */
export function parseInlineRuleList(
  spans: readonly InlineStyleSpan[],
  parser: CssRuleParser,
): CssRuleParseResult {
  const rules: CssRule[] = [];
  let inline = inlineParsers.get(parser);
  if (!parser.parseInline && !inline) {
    inline = new CssSegmentAnalysis(parser);
    inlineParsers.set(parser, inline);
  }
  for (const span of spans) {
    const parsed = parseCssRules(
      {
        parse: (text) =>
          parser.parseInline
            ? parser.parseInline(text, rules.length)
            : inline!.parse(text, rules.length),
      },
      span.text,
    );
    if (parsed.status === "unresolved") return parsed;
    for (const rule of [...parsed.rules].sort(
      (left, right) => left.ordinal - right.ordinal,
    ))
      rules.push(rebaseCssRule(rule, rules.length));
  }
  return { status: "parsed", rules };
}
