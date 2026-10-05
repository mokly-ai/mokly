/** Merge route classification with evidence loaded for one comparison. */

import type {
  ComponentReview,
  EntryChangeReason,
} from "../review/component_types.js";
import { mergeCssAnalysis } from "../review/css/evidence.js";
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
  /** Parent id of a component workspace, whose own rules keep its sentence. */
  componentId: string | undefined;
  views: readonly ViewReview[];
  resourceViews: readonly ViewResourceEvidence[];
  reasons: readonly EntryChangeReason[];
}

/**
 * Keep catalogue facts, including the selected views' live evidence in
 * Current, while adding only the loaded selection's details.
 */
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
    componentId: data.component?.path,
    views,
    resourceViews: [...resources, ...views],
    reasons: mergeReasons([
      ...(data.change?.reasons ?? []),
      ...(change?.reasons ?? []),
      ...resources.flatMap((view) => view.reasons ?? []),
      ...views.flatMap((view) => view.reasons ?? []),
    ]),
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
              analysis: mergeCssAnalysis(analyses),
            }
          : {}),
      });
    } else merged.set(key, reason);
  }
  return [...merged.values()];
}
