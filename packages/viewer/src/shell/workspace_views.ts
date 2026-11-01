/** Saved and temporary preview context selection for one workspace. */

import type { GeneratedComponentView } from "../components/views.js";
import type { ColorScheme, Viewport } from "../data/axes.js";
import { viewAxesKey, viewsUsingComponents } from "../review/shared_impact.js";

import {
  resolveViewPresentation,
  type EntryStatus,
  type ViewState,
} from "./view_status.js";
import type { WorkspaceData } from "./workspace_data.js";
import type { WorkspaceVariantSelection } from "./workspace_selection.js";

/** One coherent decision about the actual views and their comparison evidence. */
export interface ResolvedWorkspaceView {
  colorScheme: ColorScheme;
  comparisonEligible: boolean;
  evidence: "selection" | "view";
  status: EntryStatus | undefined;
  views: readonly GeneratedComponentView[];
}

/** Visible saved views plus the scheme their rendered documents actually use. */
export interface ResolvedWorkspaceViews {
  colorScheme: "dark" | "light";
  views: readonly GeneratedComponentView[];
}

/** Resolve light fallback without changing the catalogue-wide scheme preference. */
export function resolveWorkspaceViews(
  data: WorkspaceData,
  variantPath: string | undefined,
  viewport: "both" | "desktop" | "mobile",
  requestedScheme: "dark" | "light",
): ResolvedWorkspaceViews {
  const variants = data.views.filter(
    (view) => view.variantPath === variantPath,
  );
  const views = (["mobile", "desktop"] as const)
    .filter((size) => viewport === "both" || viewport === size)
    .flatMap((size) => {
      const view =
        variants.find(
          (item) =>
            item.viewport === size && item.colorScheme === requestedScheme,
        ) ??
        variants.find(
          (item) => item.viewport === size && item.colorScheme === "light",
        );
      return view ? [view] : [];
    });
  return {
    colorScheme: views.some(
      ({ colorScheme }) => colorScheme === requestedScheme,
    )
      ? requestedScheme
      : (views[0]?.colorScheme ?? requestedScheme),
    views,
  };
}

/** Select the actual visible viewport and scheme contexts for a variant. */
export function visibleWorkspaceViews(
  data: WorkspaceData,
  variantPath: string | undefined,
  viewport: "both" | "desktop" | "mobile",
  colorScheme: ColorScheme,
): readonly GeneratedComponentView[] {
  return resolveWorkspaceViews(data, variantPath, viewport, colorScheme).views;
}

/**
 * Resolve requested axes to actual renders and use per-view evidence only when
 * it covers every shown render. Otherwise preserve selection-level fallbacks.
 * A shown view that changed components affect keeps its comparison while it
 * shows Unmodified, in or out of Changes.
 */
export function resolveWorkspaceView(
  data: WorkspaceData,
  selection: WorkspaceVariantSelection,
  viewport: "both" | Viewport,
  colorScheme: ColorScheme,
): ResolvedWorkspaceView {
  const variantPath = selection.variant?.value.path;
  const resolved = resolveWorkspaceViews(
    data,
    variantPath,
    viewport,
    colorScheme,
  );
  const evidenceKey =
    data.entry.kind === "component" ? variantPath : data.entry.path;
  const states =
    evidenceKey && Object.hasOwn(data.viewStates, evidenceKey)
      ? data.viewStates[evidenceKey]
      : undefined;
  const presentation = resolveViewPresentation({
    displayedViews: resolved.views,
    fallbackComparisonEligible: selection.comparisonEligible,
    fallbackStatus: selection.variant?.status ?? data.status,
    states,
  });
  // The routed entry's detail decides; a parent route selects its own row.
  const affected =
    data.affectedComparison &&
    (selection.variant === undefined ||
      selection.variant.value.path === data.entry.path) &&
    affectedViewShown(resolved.views, states, data.relatedComponents);
  return {
    ...resolved,
    comparisonEligible: presentation.comparisonEligible || affected,
    evidence: presentation.evidence === "matching" ? "view" : "selection",
    status: presentation.status,
  };
}

/**
 * Whether a shown view is known to be Unmodified and its usage holds a changed
 * component that the routed entry's detail names.
 */
function affectedViewShown(
  views: readonly GeneratedComponentView[],
  states: readonly ViewState[] | undefined,
  components: readonly { path: string }[],
): boolean {
  const using = viewsUsingComponents(views, components);
  return views.some(
    (view) =>
      using.has(viewAxesKey(view)) &&
      states?.some(
        (state) =>
          state.viewport === view.viewport &&
          state.colorScheme === view.colorScheme &&
          state.comparison.kind === "unmodified",
      ) === true,
  );
}
