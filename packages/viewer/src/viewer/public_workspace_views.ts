/** Per-view comparison facts that a published catalogue supplies to a workspace. */

import type {
  ShellCatalogueComponent,
  ShellCatalogueScreen,
  ShellCatalogueVariant,
  ShellCatalogueView,
} from "../catalogue/scoped_types.js";
import type { ReviewState, ViewResourceEvidence } from "../review/types.js";
import { orderChangedViews, type ChangedView } from "../shell/view_marks.js";
import type { ViewState, ViewStatesBySelection } from "../shell/view_status.js";
import type { ChangedViewsBySelection } from "../shell/workspace_views_data.js";

const reviewStates: Readonly<
  Record<"added" | "changed" | "removed" | "unmodified", ReviewState>
> = {
  added: "added",
  changed: "changed",
  removed: "removed",
  unmodified: "unchanged",
};

/** Published per-view comparisons name the same changed views the shell derives. */
function publishedChangedViews(
  views: readonly ShellCatalogueView[],
): readonly ChangedView[] {
  return orderChangedViews(
    views.flatMap((view) =>
      view.comparison.status === "ready" &&
      view.comparison.kind !== "unmodified"
        ? [{ colorScheme: view.colorScheme, viewport: view.viewport }]
        : [],
    ),
  );
}

/** Key public comparison evidence exactly like the served workspace data. */
export function publishedChangedViewsBySelection(
  entry: ShellCatalogueScreen | ShellCatalogueComponent | ShellCatalogueVariant,
  variants: readonly ShellCatalogueVariant[] = [],
): ChangedViewsBySelection {
  if (entry.kind === "screen")
    return { [entry.path]: publishedChangedViews(entry.views) };
  return Object.fromEntries(
    variants.map((variant) => [
      variant.path,
      publishedChangedViews(variant.views),
    ]),
  );
}

/** Keep only published views whose comparison state is ready. */
function publishedViewStates(
  views: readonly ShellCatalogueView[],
): readonly ViewState[] | undefined {
  const states = views.flatMap((view) =>
    view.comparison.status === "ready"
      ? [
          {
            colorScheme: view.colorScheme,
            state: reviewStates[view.comparison.kind],
            viewport: view.viewport,
          },
        ]
      : [],
  );
  return states.length > 0 ? states : undefined;
}

/** Key published ready states like the served workspace evidence. */
export function publishedViewStatesBySelection(
  entry: ShellCatalogueScreen | ShellCatalogueComponent | ShellCatalogueVariant,
  variants: readonly ShellCatalogueVariant[] = [],
): ViewStatesBySelection {
  if (entry.kind === "screen") {
    const states = publishedViewStates(entry.views);
    return states === undefined
      ? (Object.create(null) as Record<string, readonly ViewState[]>)
      : { [entry.path]: states };
  }
  const evidence: Record<string, readonly ViewState[]> = Object.create(null);
  for (const variant of variants) {
    const states = publishedViewStates(variant.views);
    if (states !== undefined) evidence[variant.path] = states;
  }
  return evidence;
}

/**
 * Ready catalogue evidence for the views a workspace shows, keyed by axes.
 * Views without evidence are omitted; the result invents no comparison state.
 */
export function publishedResourceEvidence(
  views: readonly ShellCatalogueView[],
): readonly ViewResourceEvidence[] {
  return views.flatMap(({ viewport, colorScheme, resourceEvidence }) =>
    resourceEvidence ? [{ viewport, colorScheme, ...resourceEvidence }] : [],
  );
}
