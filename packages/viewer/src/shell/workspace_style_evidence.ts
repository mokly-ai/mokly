/** Pure stylesheet evidence grouping for the React Details panel. */

import type { EntryChangeReason } from "../review/component_types.js";
import type {
  DependencyAnalysis,
  ViewReview,
  ViewResourceEvidence,
} from "../review/types.js";

import { entryWording, type EntryKind } from "./entry_wording.js";

/** Analysed selectors grouped by the outcome that retained them. */
export interface StyleOutcome {
  status: DependencyAnalysis["status"];
  selectors: readonly string[];
}

/** Whether stylesheet analysis is the only reason a changed view was retained. */
export function isStyleOnlyView(view: ViewReview): boolean {
  return (
    view.state === "changed" &&
    view.material === undefined &&
    view.reasons !== undefined &&
    view.reasons.length > 0 &&
    view.reasons.every((reason) => reason.analysis !== undefined)
  );
}

/** Group selector evidence so each outcome appears once. */
export function styleOutcomes(
  reasons: readonly EntryChangeReason[] | undefined,
): readonly StyleOutcome[] {
  const groups = new Map<DependencyAnalysis["status"], Set<string>>();
  for (const reason of reasons ?? []) {
    if (reason.kind !== "dependency" || !reason.analysis) continue;
    const selectors = groups.get(reason.analysis.status) ?? new Set<string>();
    for (const selector of reason.analysis.selectors) selectors.add(selector);
    groups.set(reason.analysis.status, selectors);
  }
  return (["matched", "unresolved"] as const).flatMap((status) => {
    const selectors = groups.get(status);
    return selectors ? [{ status, selectors: [...selectors].sort() }] : [];
  });
}

/** Every changed file retained as dependency evidence. */
export function retainedPaths(
  reasons: readonly EntryChangeReason[] | undefined,
): readonly string[] {
  return [
    ...new Set(
      (reasons ?? []).flatMap((reason) =>
        reason.kind === "dependency" ? [reason.path] : [],
      ),
    ),
  ];
}

/** Stylesheets excluded in every supplied view after retaining known paths. */
export function excludedStylesheets(
  views: readonly ViewResourceEvidence[],
  retained: readonly string[],
): readonly string[] {
  const kept = new Set(retained);
  for (const view of views)
    for (const reason of view.reasons ?? []) kept.add(reason.path);
  const excluded = new Set<string>();
  for (const view of views)
    for (const resource of view.excludedResources ?? [])
      if (!kept.has(resource.path)) excluded.add(resource.path);
  return [...excluded].sort();
}

/** User-facing lead for one selector outcome. */
export function styleOutcomeLead(
  outcome: StyleOutcome,
  kind: EntryKind,
): string {
  const wording = entryWording(kind);
  if (outcome.status === "matched")
    return outcome.selectors.length
      ? wording.matchedStylesWithSelectors
      : wording.matchedStylesWithoutSelectors;
  return outcome.selectors.length
    ? wording.unresolvedStylesWithSelectors
    : wording.unresolvedStylesWithoutSelectors;
}
