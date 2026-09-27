/** Stable rule identity helpers that ignore source-local ordinals. */
import type { CssRule } from "./types.js";

/** Complete normalized rule identity, including declarations. */
export function cssRuleIdentity(rule: CssRule): string {
  return JSON.stringify([
    rule.conditions.map(({ kind, prelude }) => [kind, prelude]),
    rule.selectors,
    rule.atRule ?? null,
    rule.prelude ?? null,
    rule.block ?? null,
    rule.declarations,
  ]);
}
