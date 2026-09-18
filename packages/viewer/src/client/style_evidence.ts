/** Stylesheet evidence for comparison details and the derived style heading;
 * selector text and analysis vocabulary never leave the details list. */
import type { EntryChangeReason } from "../review/component_types.js";
import type {
  DependencyAnalysis,
  ViewReview,
  ViewResourceEvidence,
} from "../review/types.js";

import { element } from "./inspector_panels.js";

/** Analysed selectors grouped by the outcome that retained them. */
export interface StyleOutcome {
  status: DependencyAnalysis["status"];
  selectors: readonly string[];
}

const OUTCOME_LEAD: Record<DependencyAnalysis["status"], string> = {
  matched: "Changed styles that apply to this screen",
  unresolved:
    "This change can apply anywhere on the screen, so the screen stays in Changes",
};

const EXCLUDED_LEAD = {
  one: "This stylesheet changed, but none of the changed styles apply to this screen.",
  many: "These stylesheets changed, but none of the changed styles apply to this screen.",
} as const;

/** Group analysed reasons so each retained outcome reads once for the entry. */
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

/** Every changed file kept as dependency evidence, in first-seen order. */
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

/** Stylesheets examined for these views and set aside on every retaining side. */
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

/** A view kept only by stylesheet analysis reads as a style outcome. */
export function isStyleOnlyView(view: ViewReview): boolean {
  return (
    view.state === "changed" &&
    view.material === undefined &&
    view.reasons !== undefined &&
    view.reasons.length > 0 &&
    view.reasons.every((reason) => reason.analysis !== undefined)
  );
}

/** Append the changed files that may affect the compared screen. */
export function appendChangedFiles(
  doc: Document,
  panel: Element,
  paths: readonly string[],
): void {
  if (!paths.length) return;
  panel.append(
    element(doc, "p", "Changes to these files may affect this screen:"),
    pathList(doc, paths),
  );
}

/** Append the outcome lists naming the changed styles that reach this screen. */
export function appendStyleOutcomes(
  doc: Document,
  panel: Element,
  outcomes: readonly StyleOutcome[],
): void {
  for (const outcome of outcomes) {
    panel.append(element(doc, "p", outcomeLead(outcome)));
    if (!outcome.selectors.length) continue;
    const list = element(doc, "ul");
    for (const selector of outcome.selectors) {
      const item = element(doc, "li");
      const code = element(doc, "code", selector);
      code.className = "mbk-code";
      item.append(code);
      list.append(item);
    }
    panel.append(list);
  }
}

/** Append the stylesheets examined for this screen and set aside. */
export function appendExcludedStylesheets(
  doc: Document,
  panel: Element,
  paths: readonly string[],
): void {
  if (!paths.length) return;
  panel.append(
    element(
      doc,
      "p",
      paths.length === 1 ? EXCLUDED_LEAD.one : EXCLUDED_LEAD.many,
    ),
    element(doc, "p", "Examined and excluded:"),
    pathList(doc, paths),
  );
}

/** A colon introduces the selectors that follow; without them the lead closes. */
function outcomeLead(outcome: StyleOutcome): string {
  return `${OUTCOME_LEAD[outcome.status]}${outcome.selectors.length ? ":" : "."}`;
}

function pathList(doc: Document, paths: readonly string[]): HTMLUListElement {
  const list = element(doc, "ul");
  for (const path of paths) list.append(element(doc, "li", path));
  return list;
}
