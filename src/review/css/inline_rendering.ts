import { documentWorkSync } from "../../diagnostics/timings.js";

/** Canonically render inline rules and material replacements for one source side. */
import type { InlineAttributionResult } from "./inline_attribution.js";
import type { AttributedInlineRule } from "./inline_rule_matching.js";
import { cssRuleData, cssRuleIdentity } from "./rule_identity.js";
import type { CssRule } from "./types.js";

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
  return documentWorkSync("projectionMs", () => {
    let material = source;
    for (const replacement of [...projection.replacements].sort(
      (a, b) => b.start - a.start,
    ))
      material =
        material.slice(0, replacement.start) +
        replacement.text +
        material.slice(replacement.end);
    return material + projection.appendix;
  });
}

/** Render a rule multiset independently of source order and local ordinals. */
export function renderInlineRules(rules: readonly CssRule[]): string {
  return [...rules]
    .sort(compareRules)
    .map((rule) => cssRuleData(rule).canonicalText)
    .join("");
}

/** Remove analyzed elements and append each retained canonical rule set. */
export function inlineMaterialReplacements(
  result: InlineAttributionResult,
  side: "before" | "after",
): InlineMaterialReplacements {
  return documentWorkSync("inlineRuleMs", () => {
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
      actual: projection(rules.filter((rule) => !selected(excluded, rule))),
      projected: projection(
        rules.filter(
          (rule) => !selected(excluded, rule) && !selected(owned, rule),
        ),
      ),
    };
  });
}

interface SelectedRules {
  identities: ReadonlySet<string>;
  rules: ReadonlySet<CssRule>;
}

function selectedRules(
  rules: readonly AttributedInlineRule[],
  side: "before" | "after",
  kind: "excluded" | "owned",
): SelectedRules {
  const selected = rules.flatMap(({ change, attribution }) => {
    if (attribution.kind !== kind) return [];
    const rule = side === "before" ? change.before : change.after;
    return rule ? [{ change, rule }] : [];
  });
  return {
    identities: new Set(
      selected.flatMap(({ change, rule }) =>
        change.kind === "unchanged" ? [cssRuleIdentity(rule)] : [],
      ),
    ),
    rules: new Set(selected.map(({ rule }) => rule)),
  };
}

function selected(selection: SelectedRules, rule: CssRule): boolean {
  return (
    selection.rules.has(rule) || selection.identities.has(cssRuleIdentity(rule))
  );
}

function unchanged(): InlineMaterialReplacements {
  const projection = { replacements: [], appendix: "" } as const;
  return { actual: projection, projected: projection };
}

function compareRules(a: CssRule, b: CssRule): number {
  const rank = cssRuleData(a).rank - cssRuleData(b).rank;
  if (rank) return rank;
  const left = cssRuleIdentity(a);
  const right = cssRuleIdentity(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
