/** Immutable rule-derived data shared by parsing, diffing and rendering. */
import { extractCssReferences } from "../../css_references.js";

import { decodeCssIdentifier } from "./source.js";
import type { CssRule } from "./types.js";

export interface CssRuleData {
  addressKey: string;
  identityKey: string;
  rank: number;
  canonicalText: string;
  references: readonly string[];
}

const stored = new WeakMap<CssRule, CssRuleData>();
const leadingRanks = new Map([
  ["charset", 0],
  ["import", 1],
  ["namespace", 2],
  ["layer", 3],
]);

export function storeCssRuleData(rule: CssRule, data: CssRuleData): void {
  stored.set(rule, Object.freeze(data));
}

export function cssRuleData(rule: CssRule): CssRuleData {
  const existing = stored.get(rule);
  if (existing) return existing;
  const address = [
    rule.conditions.map(({ kind, prelude }) => [kind, prelude]),
    rule.selectors,
    rule.atRule ?? null,
    rule.prelude ?? null,
    rule.block ?? null,
  ];
  const name =
    rule.atRule === undefined
      ? ""
      : decodeCssIdentifier(rule.atRule).replace(/[A-Z]/g, (character) =>
          character.toLowerCase(),
        );
  const rank = rule.block ? 4 : (leadingRanks.get(name) ?? 4);
  const header =
    rule.atRule === undefined
      ? ""
      : `@${rule.atRule}${rule.prelude ? ` ${rule.prelude}` : ""}`;
  let canonicalText =
    rule.atRule === undefined
      ? `${rule.selectors.join(",")}{${rule.declarations}}`
      : rule.block
        ? `${header}{${rule.declarations}}`
        : `${header};`;
  for (const condition of [...rule.conditions].reverse())
    canonicalText =
      condition.kind === "nesting-parent"
        ? `${condition.prelude}{${canonicalText}}`
        : `@${condition.kind}${condition.prelude ? ` ${condition.prelude}` : ""}{${canonicalText}}`;
  const data = Object.freeze({
    addressKey: JSON.stringify(address),
    identityKey: JSON.stringify([...address, rule.declarations]),
    rank,
    canonicalText,
    references: Object.freeze(
      [
        ...rule.conditions
          .filter(({ kind }) => kind !== "nesting-parent")
          .map(({ prelude }) => prelude),
        ...(rule.atRule === undefined ? [] : [`${header};`]),
        rule.declarations,
      ].flatMap(extractCssReferences),
    ),
  });
  stored.set(rule, data);
  return data;
}

export function rebaseCssRule(rule: CssRule, ordinal: number): CssRule {
  const rebased = { ...rule, ordinal };
  storeCssRuleData(rebased, cssRuleData(rule));
  return rebased;
}

/** Complete normalized rule identity, including declarations. */
export function cssRuleIdentity(rule: CssRule): string {
  return cssRuleData(rule).identityKey;
}
