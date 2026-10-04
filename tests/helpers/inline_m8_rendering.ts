/** Frozen M8 text-material renderer, captured from 5e5111dc before fingerprinting. */
import { documentWorkSync } from "../../dist/diagnostics/timings.js";
/** Canonically render inline rules and material replacements for one source side. */
import type { InlineAttributionResult } from "../../dist/review/css/inline_attribution.js";
import type { AttributedInlineRule } from "../../dist/review/css/inline_rule_matching.js";
import {
  cssRuleData,
  cssRuleIdentity,
} from "../../dist/review/css/rule_identity.js";
import type { CssRule } from "../../dist/review/css/types.js";

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

const producerReferences = new WeakMap<
  InlineMaterialProjection,
  readonly string[]
>();

export function inlineMaterialReferences(
  projection: InlineMaterialProjection,
): readonly string[] {
  return producerReferences.get(projection) ?? [];
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
function canonicalInlineRules(rules: readonly CssRule[]): CssRule[] {
  return [...rules].sort(compareRules);
}

export function renderInlineRules(rules: readonly CssRule[]): string {
  return canonicalInlineRules(rules)
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
    const runs = side === "before" ? result.beforeRuns : result.afterRuns;
    const excluded = selectedRules(result.rules, side, "excluded");
    const owned = selectedRules(result.rules, side, "owned");
    const replacements = spans.map(({ start, end }) => ({
      start,
      end,
      text: "",
    }));
    const projection = (
      retained: readonly CssRule[],
    ): InlineMaterialProjection => {
      const material = {
        replacements,
        appendix: `<style>${retained.map((rule) => cssRuleData(rule).canonicalText).join("")}</style>`,
      };
      producerReferences.set(
        material,
        documentWorkSync("referenceMs", () =>
          retained.flatMap((rule) => cssRuleData(rule).references),
        ),
      );
      return material;
    };
    const actual: CssRule[] = [];
    const ownedCopies = new Map<CssRule, number>();
    for (const { run, offset } of runs)
      for (const rule of run.rules) {
        const ordinal = offset + rule.ordinal;
        if (excluded.has(ordinal)) continue;
        actual.push(rule);
        if (owned.has(ordinal))
          ownedCopies.set(rule, (ownedCopies.get(rule) ?? 0) + 1);
      }
    const ordered = canonicalInlineRules(actual);
    const projected = ordered.filter((rule) => {
      const copies = ownedCopies.get(rule) ?? 0;
      if (!copies) return true;
      ownedCopies.set(rule, copies - 1);
      return false;
    });
    return {
      actual: projection(ordered),
      projected: projection(projected),
    };
  });
}

function selectedRules(
  rules: readonly AttributedInlineRule[],
  side: "before" | "after",
  kind: "excluded" | "owned",
): ReadonlySet<number> {
  const selected = rules.flatMap(({ change, attribution }) => {
    if (attribution.kind !== kind) return [];
    const rule = side === "before" ? change.before : change.after;
    return rule ? [rule.ordinal] : [];
  });
  return new Set(selected);
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
