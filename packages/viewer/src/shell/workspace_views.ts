/** Saved and temporary preview context selection for one workspace. */

import type { GeneratedComponentView } from "../components/views.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import {
  aggregateViewStatus,
  shownComparisonEligible,
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

/** Select the actual visible viewport and scheme contexts for a variant. */
export function visibleWorkspaceViews(
  data: WorkspaceData,
  variantId: string | undefined,
  viewport: "both" | "desktop" | "mobile",
  colorScheme: ColorScheme,
): readonly GeneratedComponentView[] {
  const views = data.views.filter((view) => view.variantId === variantId);
  return (["mobile", "desktop"] as const)
    .filter((size) => viewport === "both" || viewport === size)
    .flatMap((size) => {
      const view =
        views.find(
          (item) => item.viewport === size && item.colorScheme === colorScheme,
        ) ??
        views.find(
          (item) => item.viewport === size && item.colorScheme === "light",
        );
      return view ? [view] : [];
    });
}

/**
 * Resolve requested axes to actual renders and use per-view evidence only when
 * it covers every shown render. Otherwise preserve selection-level fallbacks.
 */
export function resolveWorkspaceView(
  data: WorkspaceData,
  selection: WorkspaceVariantSelection,
  viewport: "both" | Viewport,
  colorScheme: ColorScheme,
): ResolvedWorkspaceView {
  const variantId = selection.variant?.value.id;
  const views = visibleWorkspaceViews(data, variantId, viewport, colorScheme);
  const effectiveColorScheme =
    views.length > 0 && views.every((view) => view.colorScheme === "light")
      ? "light"
      : colorScheme;
  const evidenceKey =
    data.entry.kind === "component" ? variantId : data.entry.id;
  const states = evidenceKey ? data.viewStates[evidenceKey] : undefined;
  const matched = matchingStates(states, views);
  const fallbackStatus = selection.variant?.status ?? data.status;
  const fallbackEligibility = selection.error
    ? false
    : selection.comparisonEligible;
  if (!matched)
    return {
      colorScheme: effectiveColorScheme,
      comparisonEligible: fallbackEligibility,
      evidence: "selection",
      status: fallbackStatus,
      views,
    };
  const status = aggregateViewStatus(matched) ?? fallbackStatus;
  return {
    colorScheme: effectiveColorScheme,
    comparisonEligible:
      !selection.error && shownComparisonEligible(status, data.entry.kind),
    evidence: "view",
    status,
    views,
  };
}

function matchingStates(
  states: readonly ViewState[] | undefined,
  views: readonly GeneratedComponentView[],
): readonly ViewState[] | undefined {
  if (states === undefined || views.length === 0) return;
  const matched = views.flatMap((view) => {
    const state = states.find(
      (candidate) =>
        candidate.viewport === view.viewport &&
        candidate.colorScheme === view.colorScheme,
    );
    return state ? [state] : [];
  });
  return matched.length === views.length ? matched : undefined;
}
