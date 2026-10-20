/** Merge route classification with evidence loaded for one comparison. */

import { mergeCssAnalysis } from "../review/css/evidence.js";
import {
  componentViewEntry,
  reviewComponent,
  reviewEntry,
  viewReasons,
} from "../review/entries.js";
import {
  affectedEntry,
  keepsComponentRecord,
} from "../review/shared_impact.js";
import type {
  ChangeReason,
  EvidenceReasons,
  ReviewEntry,
  ReviewResult,
  ReviewView,
} from "../review/types.js";

import type { WorkspaceData } from "./workspace_data.js";

/** Complete evidence projected into one Details panel. */
export interface WorkspaceComparisonEvidence {
  /**
   * The loaded comparison's record of the screen, or of the component parent
   * that groups its variants; absent until a comparison loads.
   */
  comparison: ReviewEntry | undefined;
  /** Parent id of a component workspace, whose own rules keep its sentence. */
  componentId: string | undefined;
  views: readonly ReviewView[];
  resourceViews: readonly EvidenceReasons[];
  reasons: readonly ChangeReason[];
  /**
   * Changes does not list the routed entry, yet changed components affect
   * it: its detail names changed components it uses, a shown view keeps a
   * component-owned record, or the loaded review lists it as affected.
   */
  sharedImpact: boolean;
}

/**
 * Keep catalogue facts, including the routed detail's reasons and the
 * selected views' live evidence in Current, while adding only the loaded
 * selection's details. Each reason appears once, whatever its sources.
 */
export function workspaceComparisonEvidence(
  data: WorkspaceData,
  variantPath?: string,
  loaded?: ReviewResult,
): WorkspaceComparisonEvidence {
  const selected =
    data.entry.kind === "component"
      ? reviewComponent(loaded, data.component?.path ?? data.entry.path)
      : reviewEntry(loaded, "screen", data.entry.path);
  const routed =
    data.entry.kind === "component" || data.entry.kind === "screen"
      ? reviewEntry(loaded, data.entry.kind, data.entry.path)
      : undefined;
  const views = comparisonViews(selected, variantPath);
  const resources = data.resourceEvidence ?? [];
  const viewEvidence = views.map(viewReasons);
  return {
    comparison: selected,
    componentId: data.component?.path,
    views,
    resourceViews: [...resources, ...viewEvidence],
    sharedImpact:
      data.included === false &&
      (data.relatedComponents.length > 0 ||
        data.componentRecords === true ||
        views.some(keepsComponentRecord) ||
        (loaded !== undefined &&
          routed !== undefined &&
          affectedEntry(loaded, routed))),
    reasons: mergeReasons([
      ...(data.reasons ?? []),
      ...(routed?.reasons ?? []),
      ...resources.flatMap((view) => view.reasons ?? []),
      ...viewEvidence.flatMap((view) => view.reasons ?? []),
    ]),
  };
}

function comparisonViews(
  comparison: ReviewEntry | undefined,
  variantPath?: string,
): readonly ReviewView[] {
  if (comparison?.kind !== "component") return comparison?.views ?? [];
  return componentViewEntry(comparison, variantPath)?.views ?? [];
}

function mergeReasons(reasons: readonly ChangeReason[]): ChangeReason[] {
  const merged = new Map<string, ChangeReason>();
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
