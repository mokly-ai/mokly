/** Pure stylesheet path and view facts for the React Details panel. */

import { viewReasons } from "../review/entries.js";
import type {
  ChangeReason,
  EntryChangeReason,
  EvidenceReasons,
  ReviewView,
} from "../review/types.js";

/**
 * Whether a changed view's change is proved only by its stylesheet records:
 * its entry has no material reason, and every file it keeps is a stylesheet.
 */
export function isStyleOnlyView(
  view: ReviewView,
  reasons: readonly EntryChangeReason[],
): boolean {
  if (
    view.state !== "changed" ||
    reasons.some((reason) => reason.kind === "material")
  )
    return false;
  const kept = viewReasons(view).reasons ?? [];
  return (
    kept.length > 0 && kept.every((reason) => reason.analysis !== undefined)
  );
}

/** Every changed file retained as dependency evidence. */
export function retainedPaths(
  reasons: readonly ChangeReason[] | undefined,
): readonly string[] {
  return [
    ...new Set(
      (reasons ?? []).flatMap((reason) =>
        reason.kind === "dependency" ? [reason.path] : [],
      ),
    ),
  ];
}

/**
 * Stylesheets excluded in every supplied view or page record after retaining
 * known paths.
 */
export function excludedStylesheets(
  views: readonly EvidenceReasons[],
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
