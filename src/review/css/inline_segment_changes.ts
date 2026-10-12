/** Cancel identity runs first; unchanged references name actual matched copies only. */
import { diffCssRuleLists } from "./diff.js";
import {
  inlineRuleDeltas,
  matchedInlineReferences,
} from "./inline_rule_deltas.js";
import {
  flattenInlineRules,
  type InlineRuleRunList,
  type InlineRunOccurrence,
} from "./inline_rule_runs.js";
import { rebaseCssRule } from "./rule_identity.js";
import type { CssRuleChange } from "./types.js";

type ParsedRuns = Extract<InlineRuleRunList, { status: "parsed" }>;

export function inlineSegmentChanges(
  before: ParsedRuns,
  after: ParsedRuns,
  diffRules = diffCssRuleLists,
) {
  let bases = before.occurrences;
  let heads = after.occurrences;
  const pairs: CssRuleChange[] = [];
  if (before.segmented && after.segmented) {
    const buckets = new Map<string, InlineRunOccurrence[]>();
    for (const occurrence of [...bases].reverse()) {
      const key = occurrence.run.identityRunKey;
      const bucket = buckets.get(key) ?? [];
      bucket.push(occurrence);
      buckets.set(key, bucket);
    }
    const cancelled = new Set<InlineRunOccurrence>();
    heads = heads.filter((head) => {
      const base = buckets.get(head.run.identityRunKey)?.pop();
      if (!base) return true;
      cancelled.add(base);
      for (const ordinal of base.run.referenceOrdinals)
        pairs.push({
          before: rebaseCssRule(
            base.run.rules[ordinal]!,
            base.offset + ordinal,
          ),
          after: rebaseCssRule(head.run.rules[ordinal]!, head.offset + ordinal),
        });
      return false;
    });
    bases = bases.filter((base) => !cancelled.has(base));
  }
  const baseRules = flattenInlineRules(bases);
  const headRules = flattenInlineRules(heads);
  const diff = diffRules(baseRules, headRules);
  pairs.push(...matchedInlineReferences(diff, baseRules, headRules));
  pairs.sort((left, right) => left.before.ordinal - right.before.ordinal);
  return { diff, deltas: inlineRuleDeltas(diff, pairs) };
}
