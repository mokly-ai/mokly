/** Merge inspector evidence without changing either classification or comparison results. */
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
import type { WorkspaceData } from "../shell/workspace_data.js";

interface WorkspaceComparisonEvidence {
  comparison: ComponentReview | ScreenReview | undefined;
  views: readonly ViewReview[];
  resourceViews: readonly ViewResourceEvidence[];
  reasons: readonly EntryChangeReason[];
  legacyPaths: readonly string[];
}

/** Keep catalogue-wide ownership facts while adding the loaded selection's details. */
export function workspaceComparisonEvidence(
  data: WorkspaceData,
  variantId?: string,
  loaded?: ReviewResult,
): WorkspaceComparisonEvidence {
  const selected =
    data.entry.kind === "component" && loaded?.schemaVersion === 3
      ? loaded.components.find((item) => item.id === data.entry.id)
      : loaded?.screens.find((item) => item.route === data.entry.route);
  const change =
    loaded?.schemaVersion === 3
      ? loaded.changes.find(
          (item) =>
            item.kind === data.entry.kind &&
            (item.after ?? item.before)?.route === data.entry.route,
        )
      : undefined;
  const views = [
    ...comparisonViews(data.comparison, variantId),
    ...comparisonViews(selected, variantId),
  ];
  const resources = data.resourceEvidence ?? [];
  return {
    comparison: data.comparison ?? selected,
    views,
    resourceViews: [...resources, ...views],
    reasons: mergeReasons([
      ...(data.change?.reasons ?? []),
      ...(change?.reasons ?? []),
      ...resources.flatMap((view) => view.reasons ?? []),
      ...(loaded?.schemaVersion === 2
        ? comparisonViews(selected, variantId).flatMap(
            (view) => view.reasons ?? [],
          )
        : []),
    ]),
    legacyPaths:
      loaded?.schemaVersion === 2 ? (selected?.sharedImpact ?? []) : [],
  };
}

function comparisonViews(
  comparison: ComponentReview | ScreenReview | undefined,
  variantId?: string,
): readonly ViewReview[] {
  return comparison && "variants" in comparison
    ? (comparison.variants.find((item) => item.id === variantId)?.views ?? [])
    : (comparison?.views ?? []);
}

function mergeReasons(
  reasons: readonly EntryChangeReason[],
): EntryChangeReason[] {
  const merged = new Map<string, EntryChangeReason>();
  for (const reason of reasons) {
    const key = `${reason.kind}:${reason.kind === "dependency" ? reason.path : reason.kind === "screen" ? reason.route : ""}`;
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
