/** Each changed file once, with the sentences and selectors its evidence proves. */

import type { EntryChangeReason } from "../review/component_types.js";
import { mergeCssAnalysis } from "../review/css/evidence.js";
import type {
  CssRuleAttribution,
  DependencyAnalysis,
} from "../review/types.js";

import { entryWording, type EntryWording } from "./entry_wording.js";

/** One outcome sentence under a stylesheet, with the selectors it names. */
export interface StylesheetOutcome {
  lead: string;
  selectors: readonly string[];
}

/** A changed file named once, with every outcome its evidence supports. */
export interface StylesheetEvidence {
  path: string;
  outcomes: readonly StylesheetOutcome[];
}

/**
 * Whose Details the evidence describes. A component workspace names its parent
 * id, so the rules that changed that component keep the component sentence. A
 * whole-document page has the screen outcomes with page wording.
 */
export type EvidenceSubject =
  | { kind: "screen" }
  | { kind: "page" }
  | { kind: "component"; componentId?: string | undefined };

const union = (values: readonly string[]) => [...new Set(values)].sort();

/**
 * Group retained reasons into one item per path, sorted by path. Analyses for
 * one path merge by rule key first; files without analysis are a path alone.
 */
export function stylesheetEvidence(
  reasons: readonly EntryChangeReason[],
  subject: EvidenceSubject,
): readonly StylesheetEvidence[] {
  const analyses = new Map<string, DependencyAnalysis[]>();
  for (const reason of reasons) {
    if (reason.kind !== "dependency") continue;
    const known = analyses.get(reason.path) ?? [];
    if (reason.analysis) known.push(reason.analysis);
    analyses.set(reason.path, known);
  }
  const wording = entryWording(subject.kind);
  const ownId = subject.kind === "component" ? subject.componentId : undefined;
  return [...analyses.keys()].sort().map((path) => {
    const found = analyses.get(path) ?? [];
    return {
      path,
      outcomes: found.length
        ? ruleOutcomes(
            mergeCssAnalysis(found.map(withRules)).rules,
            wording,
            ownId,
          )
        : [],
    };
  });
}

/** Keep rule records, or rebuild one unkeyed record from a bare summary. */
function withRules(analysis: DependencyAnalysis): DependencyAnalysis {
  return analysis.rules.length
    ? analysis
    : {
        ...analysis,
        rules: [
          {
            status: analysis.status,
            selectors: analysis.selectors,
            changedComponentPaths: [],
            pageSelectors: [],
          },
        ],
      };
}

/**
 * Own-component rules first, then proven page matches, then unresolved page
 * reasons. Only a file with none of these keeps its full matched styles.
 */
function ruleOutcomes(
  rules: readonly CssRuleAttribution[],
  wording: EntryWording,
  ownId: string | undefined,
): StylesheetOutcome[] {
  const own = ownId
    ? rules.filter((rule) => rule.changedComponentPaths.includes(ownId))
    : [];
  const page = rules.filter((rule) => rule.pageSelectors.length > 0);
  const unresolved = rules.filter(
    (rule) => rule.status === "unresolved" && !own.includes(rule),
  );
  const outcomes = [
    sentence(
      own.filter((rule) => rule.status === "matched"),
      wording.matchedStylesWithSelectors,
      wording.matchedStylesWithoutSelectors,
    ),
    sentence(
      own.filter((rule) => rule.status === "unresolved"),
      wording.unresolvedStylesWithSelectors,
      wording.unresolvedStylesWithoutSelectors,
    ),
    page.length
      ? {
          lead: page.some((rule) => rule.changedComponentPaths.length > 0)
            ? wording.pageOutsideStyles
            : wording.pageStyles,
          selectors: union(page.flatMap((rule) => rule.pageSelectors)),
        }
      : undefined,
    sentence(
      unresolved,
      wording.pageUnresolvedWithSelectors,
      wording.pageUnresolvedWithoutSelectors,
    ),
  ].filter((outcome) => outcome !== undefined);
  if (outcomes.length) return outcomes;
  const matched = sentence(
    rules,
    wording.matchedStylesWithSelectors,
    wording.matchedStylesWithoutSelectors,
  );
  return matched ? [matched] : [];
}

/** One sentence for these rules: a colon and a list, or a full stop alone. */
function sentence(
  rules: readonly CssRuleAttribution[],
  withSelectors: string,
  withoutSelectors: string,
): StylesheetOutcome | undefined {
  if (!rules.length) return undefined;
  const selectors = union(rules.flatMap((rule) => rule.selectors));
  return {
    lead: selectors.length ? withSelectors : withoutSelectors,
    selectors,
  };
}
