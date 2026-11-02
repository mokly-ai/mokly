/** Pure selection of the views and pane documents one comparison shows. */

import { snapshotViewPath } from "../navigation/routes.js";
import { keepsComponentRecord, viewAxesKey } from "../review/shared_impact.js";
import type { ComparedEntry, ReviewView } from "../review/types.js";

import type { LoadedComparison } from "./comparison_request.js";
import { schemeValue } from "./scheme_fallback.js";
import type { ComparisonPresentation } from "./use_comparison.js";
import { isStyleOnlyView } from "./workspace_style_evidence.js";

/** One viewport section's view and the snapshot addresses of its sides. */
export interface SelectedComparisonView {
  /** Absolute snapshot address of each side the view has. */
  documents: { after?: string; before?: string };
  /**
   * The view is unchanged, yet changed components affect it: it keeps a
   * component-owned record, or its usage holds a changed component that the
   * entry detail names.
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
 * or its Light fallback. `undefined` means the routed entry's detail has no
 * ready comparison. `usingChanged` holds the axes keys of the routed views
 * whose usage holds a changed component.
 */
export function selectedComparisonViews(
  loaded: LoadedComparison,
  presentation: ComparisonPresentation,
  entry: ComparedEntry | undefined,
  usingChanged: ReadonlySet<string> = new Set(),
): readonly SelectedComparisonView[] | undefined {
  if (!entry) return;
  return (["mobile", "desktop"] as const).flatMap((viewport) => {
    if (presentation.viewport !== "both" && presentation.viewport !== viewport)
      return [];
    const view = schemeValue(
      presentation.colorScheme,
      entry.views.find(
        (candidate) =>
          candidate.viewport === viewport && candidate.colorScheme === "light",
      ),
      entry.views.find(
        (candidate) =>
          candidate.viewport === viewport && candidate.colorScheme === "dark",
      ),
    );
    if (!view) return [];
    const before = view.state !== "added";
    const after = view.state !== "removed";
    return [
      {
        documents: {
          ...(before
            ? {
                before: snapshotUrl(loaded.url, "before", entry.basePath, view),
              }
            : {}),
          ...(after
            ? {
                after: snapshotUrl(loaded.url, "after", entry.path, view),
              }
            : {}),
        },
        componentsOnly:
          view.state === "unchanged" &&
          (keepsComponentRecord(view) || usingChanged.has(viewAxesKey(view))),
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
