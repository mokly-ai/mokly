/** Merge route classification with evidence loaded for one comparison. */

import type {
  ComponentReview,
  EntryChangeReason,
} from "../review/component_types.js";
import type {
  ReviewResult,
  ScreenReview,
  ViewReview,
  ViewResourceEvidence,
} from "../review/types.js";

import type { WorkspaceData } from "./workspace_data.js";
import { componentReview } from "./workspace_entry.js";

/** Complete evidence projected into one Details panel. */
export interface WorkspaceComparisonEvidence {
  comparison: ComponentReview | ScreenReview | undefined;
  views: readonly ViewReview[];
  resourceViews: readonly ViewResourceEvidence[];
  reasons: readonly EntryChangeReason[];
  sharedImpact: readonly string[];
}

/** Keep catalogue facts while adding only the loaded selection's details. */
export function workspaceComparisonEvidence(
  data: WorkspaceData,
  variantPath?: string,
  loaded?: ReviewResult,
): WorkspaceComparisonEvidence {
  const selected =
    data.entry.kind === "component"
      ? componentReview(loaded?.components, data.component, data.entry)
      : loaded?.screens.find((item) => item.path === data.entry.path);
  const change = loaded?.changes.find(
    (item) =>
      item.kind === data.entry.kind &&
      (item.after ?? item.before)?.path === data.entry.path,
  );
  const views = [
    ...comparisonViews(data.comparison, variantPath),
    ...comparisonViews(selected, variantPath),
  ];
  const resources = data.resourceEvidence ?? [];
  const comparison = data.comparison ?? selected;
  return {
    comparison,
    views,
    resourceViews: [...resources, ...views],
    reasons: mergeReasons([
      ...(data.change?.reasons ?? []),
      ...(change?.reasons ?? []),
      ...resources.flatMap((view) => view.reasons ?? []),
      ...comparisonViews(selected, variantPath).flatMap(
        (view) => view.reasons ?? [],
      ),
    ]),
    sharedImpact: comparison?.sharedImpact ?? [],
  };
}

function comparisonViews(
  comparison: ComponentReview | ScreenReview | undefined,
  variantPath?: string,
): readonly ViewReview[] {
  return comparison && "variants" in comparison
    ? (comparison.variants.find((item) => item.path === variantPath)?.views ??
        [])
    : (comparison?.views ?? []);
}

function mergeReasons(
  reasons: readonly EntryChangeReason[],
): EntryChangeReason[] {
  const merged = new Map<string, EntryChangeReason>();
  for (const reason of reasons) {
    const key = `${reason.kind}:${
      reason.kind === "dependency"
        ? reason.path
        : reason.kind === "screen"
          ? reason.screenPath
          : ""
    }`;
    const previous = merged.get(key);
    if (reason.kind === "dependency" && previous?.kind === "dependency") {
      const analyses = [previous.analysis, reason.analysis].filter(
        (analysis) => analysis !== undefined,
      );
      merged.set(key, {
        ...reason,
        ...(analyses.length
          ? {
              analysis: {
                status: analyses.some(
                  (analysis) => analysis.status === "unresolved",
                )
                  ? "unresolved"
                  : "matched",
                selectors: [
                  ...new Set(
                    analyses.flatMap((analysis) => analysis.selectors),
                  ),
                ].sort(),
              },
            }
          : {}),
      });
    } else merged.set(key, reason);
  }
  return [...merged.values()];
}
