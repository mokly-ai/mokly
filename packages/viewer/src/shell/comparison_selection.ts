/** Pure selection of the views and pane documents one comparison shows. */

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

/** The screen or saved variant record owning a route's comparison views. */
function comparisonEntry(
  loaded: LoadedComparison,
  route: string,
  variantId: string | undefined,
): { views: readonly ViewReview[] } | undefined {
  const component =
    loaded.result.schemaVersion === 3
      ? loaded.result.components.find((candidate) => candidate.route === route)
      : undefined;
  if (component)
    return component.variants.find((candidate) => candidate.id === variantId);
  return loaded.result.screens.find((candidate) => candidate.route === route);
}

/** Resolve a metadata-named snapshot beneath its comparison's generation. */
function snapshotUrl(base: string, source: string): string {
  return new URL(source.split("/").map(encodeURIComponent).join("/"), base)
    .href;
}

/**
 * The views a presentation shows, mobile first, each in the selected scheme
 * or its Light fallback. `undefined` means the route has no comparison record.
 */
export function selectedComparisonViews(
  loaded: LoadedComparison,
  presentation: ComparisonPresentation,
  route: string,
  variantId: string | undefined,
): readonly SelectedComparisonView[] | undefined {
  const entry = comparisonEntry(loaded, route, variantId);
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
    return [
      {
        documents: {
          ...(view.beforePath
            ? { before: snapshotUrl(loaded.url, view.beforePath) }
            : {}),
          ...(view.afterPath
            ? { after: snapshotUrl(loaded.url, view.afterPath) }
            : {}),
        },
        mode: view.beforePath && view.afterPath ? presentation.mode : "side",
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
