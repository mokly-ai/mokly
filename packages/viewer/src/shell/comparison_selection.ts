/** Pure selection of the views and pane documents one comparison shows. */

import { snapshotViewPath, type ViewRouteKind } from "../navigation/routes.js";
import type { ViewReview } from "../review/types.js";

import type { LoadedComparison } from "./comparison_request.js";
import type { ComparisonPresentation } from "./use_comparison.js";

/** One viewport section's view and the snapshot addresses of its sides. */
export interface SelectedComparisonView {
  /** Absolute snapshot address of each side the view has. */
  documents: { after?: string; before?: string };
  /** The mode this view shows; one-sided views fall back to Side by side. */
  mode: ComparisonPresentation["mode"];
  view: ViewReview;
  viewport: "desktop" | "mobile";
}

/** Find the path-addressed v7 result record for one routed screen or variant. */
function comparisonEntry(
  loaded: LoadedComparison,
  kind: ViewRouteKind,
  id: string,
):
  | {
      views: readonly ViewReview[];
      before?: { path: string };
      after?: { path: string };
    }
  | undefined {
  if (kind === "screen")
    return loaded.result.screens.find((candidate) => candidate.path === id);
  return loaded.result.components
    .flatMap((component) => component.variants)
    .find((candidate) => candidate.path === id);
}

/** Resolve a derived snapshot path beneath its comparison's generation. */
function snapshotUrl(
  base: string,
  side: "after" | "before",
  id: string,
  view: ViewReview,
): string {
  const source = snapshotViewPath(side, id, view.viewport, view.colorScheme);
  return new URL(source.split("/").map(encodeURIComponent).join("/"), base)
    .href;
}

/**
 * The views a presentation shows, mobile first, each in the selected scheme
 * or its Light fallback. `undefined` means the identity has no result record.
 */
export function selectedComparisonViews(
  loaded: LoadedComparison,
  presentation: ComparisonPresentation,
  kind: ViewRouteKind,
  id: string,
): readonly SelectedComparisonView[] | undefined {
  const entry = comparisonEntry(loaded, kind, id);
  if (!entry) return;
  return (["mobile", "desktop"] as const).flatMap((viewport) => {
    if (presentation.viewport !== "both" && presentation.viewport !== viewport)
      return [];
    const view =
      entry.views.find(
        (candidate) =>
          candidate.viewport === viewport &&
          candidate.colorScheme === presentation.colorScheme,
      ) ??
      entry.views.find(
        (candidate) =>
          candidate.viewport === viewport && candidate.colorScheme === "light",
      );
    if (!view) return [];
    const before = view.state !== "added";
    const after = view.state !== "removed";
    return [
      {
        documents: {
          ...(before
            ? {
                before: snapshotUrl(
                  loaded.url,
                  "before",
                  entry.before?.path ?? id,
                  view,
                ),
              }
            : {}),
          ...(after
            ? {
                after: snapshotUrl(
                  loaded.url,
                  "after",
                  entry.after?.path ?? id,
                  view,
                ),
              }
            : {}),
        },
        mode: before && after ? presentation.mode : "side",
        view,
        viewport,
      },
    ];
  });
}

/** Every pane document the selected views need, in display order. */
export function selectedComparisonDocuments(
  views: readonly SelectedComparisonView[] | undefined,
): readonly string[] {
  return (views ?? []).flatMap(({ documents }) =>
    [documents.before, documents.after].filter(
      (address): address is string => address !== undefined,
    ),
  );
}
