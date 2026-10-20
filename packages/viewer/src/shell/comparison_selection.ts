/** Pure selection of the views and pane documents one comparison shows. */

import { snapshotViewPath, type ViewRouteKind } from "../navigation/routes.js";
import { reviewEntry } from "../review/entries.js";
import {
  affectedEntry,
  keepsComponentRecord,
} from "../review/shared_impact.js";
import type { ReviewView } from "../review/types.js";

import type { LoadedComparison } from "./comparison_request.js";
import type { ComparisonPresentation } from "./use_comparison.js";
import { isStyleOnlyView } from "./workspace_style_evidence.js";

/** One viewport section's view and the snapshot addresses of its sides. */
export interface SelectedComparisonView {
  /** Absolute snapshot address of each side the view has. */
  documents: { after?: string; before?: string };
  /**
   * The view is unchanged, yet changed components affect it: it keeps a
   * component-owned record, or the review's affected records name it.
   */
  componentsOnly: boolean;
  /** The mode this view shows; one-sided views fall back to Side by side. */
  mode: ComparisonPresentation["mode"];
  /**
   * The view is changed, its entry has a reason, every reason is a
   * dependency, each named path has a rule of any status on this view, and
   * at least one named path has a matched or unresolved rule on this view.
   */
  styleOnly: boolean;
  view: ReviewView;
  viewport: "desktop" | "mobile";
}

/** Resolve a derived snapshot path beneath its comparison's generation. */
function snapshotUrl(
  base: string,
  side: "after" | "before",
  id: string,
  view: ReviewView,
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
  const entry = reviewEntry(loaded.result, kind, id);
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
        componentsOnly:
          view.state === "unchanged" &&
          (keepsComponentRecord(view) ||
            affectedEntry(loaded.result, entry, view)),
        mode: before && after ? presentation.mode : "side",
        styleOnly: isStyleOnlyView(view, entry.reasons),
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
