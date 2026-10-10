/** Group owned reference-bearing inline rules by their inferred owner set. */
import type { InlineAttributionResult } from "./inline_attribution.js";
import { cssRuleReferences } from "./material.js";
import { cssRuleIdentity } from "./rule_identity.js";
import type { CssRule } from "./types.js";

/** Canonical rule set whose complete resource closure shares the same owners. */
export interface InlineOwnedRuleGroup {
  componentIds: readonly string[];
  rules: readonly CssRule[];
}

/** Select each distinct owned reference rule available on one document side. */
export function inlineOwnedRuleGroups(
  result: InlineAttributionResult | undefined,
  side: "before" | "after",
): readonly InlineOwnedRuleGroup[] {
  if (result?.status !== "resolved") return [];
  const groups = new Map<
    string,
    { componentIds: readonly string[]; rules: Map<string, CssRule> }
  >();
  for (const { change, attribution } of result.rules) {
    if (attribution.kind !== "owned") continue;
    const rule = side === "before" ? change.before : change.after;
    if (!rule || cssRuleReferences(rule).length === 0) continue;
    const key = JSON.stringify(attribution.componentIds);
    const group = groups.get(key) ?? {
      componentIds: attribution.componentIds,
      rules: new Map(),
    };
    group.rules.set(cssRuleIdentity(rule), rule);
    groups.set(key, group);
  }
  return [...groups]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, group]) => ({
      componentIds: group.componentIds,
      rules: [...group.rules.values()],
    }));
}
