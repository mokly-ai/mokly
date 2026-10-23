/** The review v8 records one shell route shows, and their presented evidence. */

import type {
  EvidenceReasons,
  ReviewEntry,
  ReviewKind,
  ReviewResult,
  ReviewView,
} from "./types.js";
import { viewEvidenceReasons } from "./view_evidence.js";

/** The entry of a screen, a component parent, or a variant it groups. */
export function reviewEntry(
  result: ReviewResult | undefined,
  kind: ReviewKind,
  path: string,
): ReviewEntry | undefined {
  for (const entry of result?.entries ?? []) {
    if (entry.kind !== kind) continue;
    if (entry.path === path) return entry;
    const variant = entry.variants?.find((item) => item.path === path);
    if (variant) return variant;
  }
  return undefined;
}

/** The component parent whose own entry or one of whose variants has a path. */
export function reviewComponent(
  result: ReviewResult | undefined,
  path: string,
): ReviewEntry | undefined {
  return result?.entries.find(
    (entry) =>
      entry.kind === "component" &&
      (entry.path === path ||
        (entry.variants ?? []).some((variant) => variant.path === path)),
  );
}

/** One view's rule and resource records, presented as dependency evidence. */
export function viewReasons(view: ReviewView): EvidenceReasons {
  return viewEvidenceReasons({
    rules: view.rules ?? [],
    resources: view.resources ?? [],
  });
}

/** A component parent's own entry, or the variant it groups with a path. */
export function componentViewEntry(
  parent: ReviewEntry,
  path: string | undefined,
): ReviewEntry | undefined {
  return path === parent.path
    ? parent
    : parent.variants?.find((variant) => variant.path === path);
}
