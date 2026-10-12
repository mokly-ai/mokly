/** Keep segment occurrences lightweight until changed rules need document ordinals. */
import type { InlineStyleSpan } from "./inline_styles.js";
import { rebaseCssRule } from "./rule_identity.js";
import { CssSegmentAnalysis } from "./segment_analysis.js";
import {
  CssRuleParseError,
  type CssInlineParseResult,
  type CssRule,
  type CssRuleParser,
  type CssRuleParseResult,
  type CssSegmentRun,
} from "./types.js";

export interface InlineRunOccurrence {
  run: CssSegmentRun;
  offset: number;
}

export type InlineRuleRunList =
  | {
      status: "parsed";
      occurrences: readonly InlineRunOccurrence[];
      segmented: boolean;
    }
  | Extract<CssRuleParseResult, { status: "unresolved" }>;

const drivers = new WeakMap<CssRuleParser, CssSegmentAnalysis>();

export function parseInlineRuns(
  spans: readonly InlineStyleSpan[],
  parser: CssRuleParser,
): InlineRuleRunList {
  let driver = drivers.get(parser);
  if (!parser.parseInlineRuns && !driver) {
    driver = new CssSegmentAnalysis(parser);
    drivers.set(parser, driver);
  }
  const occurrences: InlineRunOccurrence[] = [];
  let offset = 0;
  let segmented = true;
  for (const span of spans) {
    let parsed: CssInlineParseResult;
    try {
      parsed = parser.parseInlineRuns
        ? parser.parseInlineRuns(span.text)
        : driver!.parseRuns(span.text);
    } catch (cause) {
      return { status: "unresolved", error: new CssRuleParseError(cause) };
    }
    if (parsed.status === "unresolved") return parsed;
    const runs =
      parsed.status === "segmented"
        ? parsed.runs
        : [
            {
              rules: [...parsed.rules]
                .sort((left, right) => left.ordinal - right.ordinal)
                .map((rule, ordinal) => rebaseCssRule(rule, ordinal)),
              identityRunKey: "",
              referenceOrdinals: [],
            },
          ];
    if (parsed.status !== "segmented") segmented = false;
    for (const run of runs) {
      occurrences.push({ run, offset });
      offset += run.rules.length;
    }
  }
  return { status: "parsed", occurrences, segmented };
}

export function flattenInlineRules(
  occurrences: readonly InlineRunOccurrence[],
): CssRule[] {
  return occurrences.flatMap(({ run, offset }) =>
    run.rules.map((rule) => rebaseCssRule(rule, offset + rule.ordinal)),
  );
}
