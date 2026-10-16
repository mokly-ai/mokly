/** Pure stylesheet path and view facts for the React Details panel. */

import type {
  ChangeReason,
  EntryChangeReason,
  EvidenceReasons,
  ReviewView,
} from "../review/types.js";

/**
 * Whether a view reads as a style change: the view is `changed`, every
 * reason of its entry is a `dependency`, and each named path has a retained
 * (matched or unresolved) rule on this view. An excluded rule says no changed
 * style applies, and a resource is no rule, so either keeps the ordinary
 * label; so does an entry that names no reason.
 */
export function isStyleOnlyView(
  view: ReviewView,
  reasons: readonly EntryChangeReason[],
): boolean {
  if (view.state !== "changed" || !reasons.length) return false;
  const ruled = new Set(
    (view.rules ?? []).flatMap((rule) =>
      rule.status === "excluded" ? [] : [rule.stylesheet],
    ),
  );
  return reasons.every(
    (reason) => reason.kind === "dependency" && ruled.has(reason.path),
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
