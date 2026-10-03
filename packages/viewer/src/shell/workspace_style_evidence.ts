/** Pure stylesheet path and view facts for the React Details panel. */

import type { EntryChangeReason } from "../review/component_types.js";
import type { ViewReview, ViewResourceEvidence } from "../review/types.js";

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
