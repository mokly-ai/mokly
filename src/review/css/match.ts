/** Apply the conservative keep rules before testing selectors against paired documents. */
import { compile } from "css-select";
import { parse } from "css-what";
import type { Selector } from "css-what";

import { cssDocumentOptions } from "./document.js";
import type { CssDocumentPair } from "./document.js";
import { matchingElements } from "./document_query.js";
import { CssSelectorError } from "./match_types.js";
import type {
  CssRuleDelta,
  CssRuleMatchResult,
  CssElementMatch,
  CssRuleMatch,
} from "./match_types.js";
import { changedCustomProperties, changedReferences } from "./material.js";
import { resolveRuleSelectors } from "./nesting.js";
import { selectorFeatures, staticSelectors } from "./pseudos.js";
import type { CssRuleDiffResult } from "./types.js";

/** Match every diffed rule against both view documents without changing classification. */
export function matchCssRules(
  diff: CssRuleDiffResult,
  documents: CssDocumentPair,
): CssRuleMatchResult {
  if (diff.status === "unresolved") return diff;
  const changes: CssRuleDelta[] = [
    ...diff.added.map((after) => ({ kind: "added" as const, after })),
    ...diff.removed.map((before) => ({ kind: "removed" as const, before })),
    ...diff.changed.map((change) => ({ kind: "changed" as const, ...change })),
  ];
  return {
    status: "resolved",
    rules: changes.map((change) => ({
      change,
      ...matchRule(change, documents),
    })),
  };
}

function matchRule(
  change: CssRuleDelta,
  documents: CssDocumentPair,
): Pick<CssRuleMatch, "outcome" | "matches"> {
  const rules = [change.before, change.after].filter(
    (rule) => rule !== undefined,
  );
  const selectors = [
    ...new Set(rules.flatMap((rule) => rule.selectors)),
  ].sort();
  const kept = (
    status: "matched" | "unresolved",
    matches: readonly CssElementMatch[] = [],
  ): Pick<CssRuleMatch, "outcome" | "matches"> => ({
    outcome: { kind: "kept", status, selectors },
    matches,
  });
  const prepared = prepareSelectors(change);
  if (
    prepared.status === "unresolved" &&
    prepared.error.kind === "selector-parse-failed"
  )
    return kept("unresolved");
  if (
    prepared.status === "parsed" &&
    prepared.queries.some(({ query }) => selectorFeatures(query).shadow)
  )
    return kept("unresolved");
  if (
    prepared.status === "parsed" &&
    prepared.queries.some(({ query }) => selectorFeatures(query).global)
  )
    return kept("unresolved");
  if (prepared.status === "unresolved") return kept("unresolved");
  if (changedCustomProperties(change.before, change.after))
    return kept("unresolved");
  if (rules.some((rule) => rule.selectors.length === 0))
    return kept("unresolved");
  if (changedReferences(change.before, change.after)) return kept("unresolved");
  const matches: CssElementMatch[] = [];
  try {
    for (const { query, selector } of prepared.queries)
      for (const side of ["before", "after"] as const) {
        const document = documents[side];
        if (document)
          for (const element of matchingElements(query, document))
            matches.push({ side, document, element, selector });
      }
  } catch (error) {
    if (error instanceof CssSelectorError) return kept("unresolved");
    throw error;
  }
  return matches.length
    ? kept("matched", matches)
    : { outcome: { kind: "excluded" }, matches: [] };
}

function prepareSelectors(
  change: CssRuleDelta,
):
  | { status: "parsed"; queries: { query: Selector[][]; selector: string }[] }
  | { status: "unresolved"; error: CssSelectorError } {
  try {
    const rules = [change.before, change.after].filter(
      (rule) => rule !== undefined,
    );
    const seen = new Set<string>();
    const queries = rules.flatMap((rule) =>
      resolveRuleSelectors(rule).flatMap((resolved, index) => {
        const selector = rule.selectors[index]!;
        const key = JSON.stringify([selector, resolved]);
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ query: parse(resolved), selector }];
      }),
    );
    for (const { query } of queries) {
      const features = selectorFeatures(query);
      if (!features.shadow)
        compile(staticSelectors(query, true, false), cssDocumentOptions());
    }
    return { status: "parsed", queries };
  } catch (cause) {
    return {
      status: "unresolved",
      error:
        cause instanceof CssSelectorError
          ? cause
          : new CssSelectorError("selector-parse-failed", cause),
    };
  }
}
