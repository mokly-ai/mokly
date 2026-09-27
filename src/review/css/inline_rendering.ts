/** Canonically render inline rules and material replacements for one source side. */
import type { InlineAttributionResult } from "./inline_attribution.js";
import type { AttributedInlineRule } from "./inline_rule_matching.js";
import { decodeCssIdentifier } from "./source.js";
import type { CssRule, CssRuleCondition } from "./types.js";

/** One original-coordinate edit consumed by the comparison replacement pass. */
export interface InlineMaterialReplacement {
  start: number;
  end: number;
  text: string;
}

/** Removals and the canonical material appended after the source document. */
export interface InlineMaterialProjection {
  replacements: readonly InlineMaterialReplacement[];
  appendix: string;
}

/** Actual and entry-projected material for one side of a paired view. */
export interface InlineMaterialReplacements {
  actual: InlineMaterialProjection;
  projected: InlineMaterialProjection;
}

/** Apply original-coordinate replacements before appending canonical material. */
export function applyInlineMaterial(
  source: string,
  projection: InlineMaterialProjection,
): string {
  let material = source;
  for (const replacement of [...projection.replacements].sort(
    (a, b) => b.start - a.start,
  ))
    material =
      material.slice(0, replacement.start) +
      replacement.text +
      material.slice(replacement.end);
  return material + projection.appendix;
}

/** Render a rule multiset independently of source order and local ordinals. */
export function renderInlineRules(rules: readonly CssRule[]): string {
  return [...rules].sort(compareRules).map(renderRule).join("");
}

/** Remove analyzed elements and append each retained canonical rule set. */
export function inlineMaterialReplacements(
  result: InlineAttributionResult,
  side: "before" | "after",
): InlineMaterialReplacements {
  if (result.status !== "resolved") return unchanged();
  const spans = side === "before" ? result.beforeSpans : result.afterSpans;
  const rules = side === "before" ? result.beforeRules : result.afterRules;
  const excluded = selectedRules(result.rules, side, "excluded");
  const owned = selectedRules(result.rules, side, "owned");
  const replacements = spans.map(({ start, end }) => ({
    start,
    end,
    text: "",
  }));
  const projection = (
    retained: readonly CssRule[],
  ): InlineMaterialProjection => ({
    replacements,
    appendix: `<style>${renderInlineRules(retained)}</style>`,
  });
  return {
    actual: projection(rules.filter((rule) => !excluded.has(rule))),
    projected: projection(
      rules.filter((rule) => !excluded.has(rule) && !owned.has(rule)),
    ),
  };
}

function selectedRules(
  rules: readonly AttributedInlineRule[],
  side: "before" | "after",
  kind: "excluded" | "owned",
): ReadonlySet<CssRule> {
  return new Set(
    rules.flatMap(({ change, attribution }) => {
      if (attribution.kind !== kind) return [];
      const rule = side === "before" ? change.before : change.after;
      return rule ? [rule] : [];
    }),
  );
}

function unchanged(): InlineMaterialReplacements {
  const projection = { replacements: [], appendix: "" } as const;
  return { actual: projection, projected: projection };
}

function compareRules(a: CssRule, b: CssRule): number {
  const rank = leadingRank(a) - leadingRank(b);
  if (rank) return rank;
  const left = identity(a);
  const right = identity(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function leadingRank(rule: CssRule): number {
  if (!isAtRule(rule) || rule.block) return 4;
  const name = decodeCssIdentifier(rule.atRule).toLowerCase();
  return name === "charset"
    ? 0
    : name === "import"
      ? 1
      : name === "namespace"
        ? 2
        : name === "layer"
          ? 3
          : 4;
}

function identity(rule: CssRule): string {
  return JSON.stringify([
    rule.conditions.map(({ kind, prelude }) => [kind, prelude]),
    rule.selectors,
    rule.atRule ?? null,
    rule.prelude ?? null,
    rule.block ?? null,
    rule.declarations,
  ]);
}

function renderRule(rule: CssRule): string {
  let rendered = isAtRule(rule)
    ? renderAtRule(rule)
    : `${rule.selectors.join(",")}{${rule.declarations}}`;
  for (const condition of [...rule.conditions].reverse())
    rendered = renderCondition(condition, rendered);
  return rendered;
}

function renderAtRule(
  rule: Extract<CssRule, { selectors: readonly [] }>,
): string {
  const header = `@${rule.atRule}${rule.prelude ? ` ${rule.prelude}` : ""}`;
  return rule.block ? `${header}{${rule.declarations}}` : `${header};`;
}

function isAtRule(
  rule: CssRule,
): rule is Extract<CssRule, { selectors: readonly [] }> {
  return rule.atRule !== undefined;
}

function renderCondition(condition: CssRuleCondition, content: string): string {
  if (condition.kind === "nesting-parent")
    return `${condition.prelude}{${content}}`;
  const prelude = condition.prelude ? ` ${condition.prelude}` : "";
  return `@${condition.kind}${prelude}{${content}}`;
}
