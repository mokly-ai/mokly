/** Extend inline rule diffs with unchanged reference-bearing identities. */
import type { CssRuleDelta } from "../../src/review/css/match_types.js";
import { cssRuleReferences } from "../../src/review/css/material.js";
import { cssRuleIdentity } from "../../src/review/css/rule_identity.js";
import type { CssRule, CssRuleDiffResult } from "../../src/review/css/types.js";

/** Return diffed occurrences plus one paired representative per unchanged reference identity. */
export function inlineRuleDeltas(
  diff: Extract<CssRuleDiffResult, { status: "resolved" }>,
  before: readonly CssRule[],
  after: readonly CssRule[],
): CssRuleDelta[] {
  return [
    ...diff.added.map((rule) => ({ kind: "added" as const, after: rule })),
    ...diff.removed.map((rule) => ({ kind: "removed" as const, before: rule })),
    ...diff.changed.map((change) => ({ kind: "changed" as const, ...change })),
    ...unchangedReferences(before, after),
  ];
}

function unchangedReferences(
  before: readonly CssRule[],
  after: readonly CssRule[],
): CssRuleDelta[] {
  const heads = new Map(after.map((rule) => [cssRuleIdentity(rule), rule]));
  const seen = new Set<string>();
  return before.flatMap((rule) => {
    const identity = cssRuleIdentity(rule);
    const counterpart = heads.get(identity);
    if (
      seen.has(identity) ||
      !counterpart ||
      cssRuleReferences(rule).length === 0
    )
      return [];
    seen.add(identity);
    return [{ kind: "unchanged" as const, before: rule, after: counterpart }];
  });
}
