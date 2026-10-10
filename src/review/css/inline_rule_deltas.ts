/** Extend inline rule diffs with actual unchanged reference-bearing occurrence pairs. */
import type { CssRuleDelta } from "./match_types.js";
import { cssRuleReferences } from "./material.js";
import { cssRuleIdentity } from "./rule_identity.js";
import type { CssRule, CssRuleChange, CssRuleDiffResult } from "./types.js";

/** Return diffed occurrences plus the already-matched unchanged reference copies. */
export function inlineRuleDeltas(
  diff: Extract<CssRuleDiffResult, { status: "resolved" }>,
  pairs: readonly CssRuleChange[],
): CssRuleDelta[] {
  return [
    ...diff.added.map((rule) => ({ kind: "added" as const, after: rule })),
    ...diff.removed.map((rule) => ({ kind: "removed" as const, before: rule })),
    ...diff.changed.map((change) => ({ kind: "changed" as const, ...change })),
    ...pairs.map((pair) => ({ kind: "unchanged" as const, ...pair })),
  ];
}

export function matchedInlineReferences(
  diff: Extract<CssRuleDiffResult, { status: "resolved" }>,
  before: readonly CssRule[],
  after: readonly CssRule[],
): CssRuleChange[] {
  const usedBefore = new Set(
    [...diff.removed, ...diff.changed.map(({ before }) => before)].map(
      ({ ordinal }) => ordinal,
    ),
  );
  const usedAfter = new Set(
    [...diff.added, ...diff.changed.map(({ after }) => after)].map(
      ({ ordinal }) => ordinal,
    ),
  );
  const buckets = new Map<string, CssRule[]>();
  for (const rule of [...before].reverse()) {
    if (usedBefore.has(rule.ordinal)) continue;
    const identity = cssRuleIdentity(rule);
    const bucket = buckets.get(identity) ?? [];
    bucket.push(rule);
    buckets.set(identity, bucket);
  }
  const pairs: CssRuleChange[] = [];
  for (const head of after) {
    if (usedAfter.has(head.ordinal)) continue;
    const base = buckets.get(cssRuleIdentity(head))?.pop();
    if (base && cssRuleReferences(base).length)
      pairs.push({ before: base, after: head });
  }
  return pairs;
}
