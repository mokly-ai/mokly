/** Merge route classification with the routed detail's comparison evidence. */

import { mergeCssAnalysis } from "../review/css/evidence.js";
import { keepsComponentRecord } from "../review/shared_impact.js";
import type {
  ChangeReason,
  ComparedEntry,
  EvidenceReasons,
  ReviewView,
} from "../review/types.js";
import { viewEvidenceReasons } from "../review/view_evidence.js";

import type { WorkspaceData } from "./workspace_data.js";

/** Complete evidence projected into one Details panel. */
export interface WorkspaceComparisonEvidence {
  /** The routed entry's comparison facts, absent until a comparison loads. */
  comparison: ComparedEntry | undefined;
  /** Parent id of a component workspace, whose own rules keep its sentence. */
  componentId: string | undefined;
  views: readonly ReviewView[];
  resourceViews: readonly EvidenceReasons[];
  reasons: readonly ChangeReason[];
  /**
   * Changes does not list the routed entry, yet changed components affect
   * it: its detail names changed components it uses, or a shown view keeps a
   * component-owned record.
   */
  sharedImpact: boolean;
}

/**
 * Keep catalogue facts, including the routed detail's reasons and the
 * selected views' live evidence in Current, while adding the compared views'
 * evidence once a comparison loads. Each reason appears once, whatever its
 * sources.
 */
export function workspaceComparisonEvidence(
  data: WorkspaceData,
  compared: boolean,
): WorkspaceComparisonEvidence {
  const comparison = compared ? data.compared : undefined;
  const views = comparison?.views ?? [];
  const resources = data.resourceEvidence ?? [];
  const viewEvidence = views.map((view) =>
    viewEvidenceReasons({
      rules: [...(view.rules ?? [])],
      resources: [...(view.resources ?? [])],
    }),
  );
  return {
    comparison,
    componentId: data.component?.path,
    views,
    resourceViews: [...resources, ...viewEvidence],
    sharedImpact:
      data.included === false &&
      (data.relatedComponents.length > 0 ||
        data.componentRecords === true ||
        views.some(keepsComponentRecord)),
    reasons: mergeReasons([
      ...(data.reasons ?? []),
      ...resources.flatMap((view) => view.reasons ?? []),
      ...viewEvidence.flatMap((view) => view.reasons ?? []),
    ]),
  };
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
