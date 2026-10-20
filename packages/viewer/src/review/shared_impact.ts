/**
 * Where changed components affect an entry whose own content is unchanged:
 * the component-owned records its views keep, and the review's affected
 * records that name its views.
 */

import type { ResourceEvidence, RuleEvidence } from "../catalogue/types.js";

import type { ReviewEntry, ReviewResult } from "./types.js";

/** One view's records: an entry detail's view evidence or a review view. */
interface ViewRecords {
  readonly rules?: readonly RuleEvidence[];
  readonly resources?: readonly ResourceEvidence[];
}

/** One view's axes. */
interface ViewAxes {
  readonly viewport: "mobile" | "desktop";
  readonly colorScheme: "light" | "dark";
}

/**
 * Whether a view keeps a retained rule or a rendered resource that a
 * component owns. An excluded rule changes nothing, so it does not count.
 */
export function keepsComponentRecord(view: ViewRecords): boolean {
  return (
    (view.rules ?? []).some(
      (rule) => rule.owner.kind === "component" && rule.status !== "excluded",
    ) ||
    (view.resources ?? []).some(
      (resource) => resource.owner.kind === "component",
    )
  );
}

/**
 * Whether the review's affected records name the entry: evidence whose
 * context is the entry's view on that evidence's side, so a moved entry
 * matches its previous path on the before side. With `axes`, only evidence
 * of that view counts.
 */
export function affectedEntry(
  result: ReviewResult,
  entry: Pick<ReviewEntry, "after" | "before" | "kind">,
  axes?: ViewAxes,
): boolean {
  return result.affected.some((record) =>
    record.evidence.some(
      ({ context, side }) =>
        context.kind === entry.kind &&
        context.entry.path === entry[side]?.path &&
        (axes === undefined ||
          (context.viewport === axes.viewport &&
            context.colorScheme === axes.colorScheme)),
    ),
  );
}
