/** Pure stylesheet path and view facts for the React Details panel. */

import type {
  ChangeReason,
  EntryChangeReason,
  EvidenceReasons,
  ReviewView,
} from "../review/types.js";

/**
 * Whether a view reads as a style change: the view is `changed`, its entry
 * has a reason, every reason is a `dependency`, each named path has a rule of
 * any status on this view, and at least one named path has a retained
 * (matched or unresolved) rule on this view. So a stylesheet whose changes
 * apply to other views only, with its `excluded` record here, keeps this
 * view's style heading while another named stylesheet applies. A resource is
 * no rule, so a named font or image keeps the ordinary label; so does a view
 * whose named stylesheets are all excluded, because no changed style applies.
 */
export function isStyleOnlyView(
  view: ReviewView,
  reasons: readonly EntryChangeReason[],
): boolean {
  if (view.state !== "changed" || !reasons.length) return false;
  const rules = view.rules ?? [];
  const ruled = new Set(rules.map((rule) => rule.stylesheet));
  const retained = new Set(
    rules.flatMap((rule) =>
      rule.status === "excluded" ? [] : [rule.stylesheet],
    ),
  );
  return (
    reasons.every(
      (reason) => reason.kind === "dependency" && ruled.has(reason.path),
    ) &&
    reasons.some(
      (reason) => reason.kind === "dependency" && retained.has(reason.path),
    )
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
