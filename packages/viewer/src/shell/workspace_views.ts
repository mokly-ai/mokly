/** Saved and temporary preview context selection for one workspace. */

import type { GeneratedComponentView } from "../components/views.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import { resolveViewPresentation, type EntryStatus } from "./view_status.js";
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
  variantId: string | undefined,
  viewport: "both" | "desktop" | "mobile",
  requestedScheme: "dark" | "light",
): ResolvedWorkspaceViews {
  const variants = data.views.filter((view) => view.variantId === variantId);
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
  variantId: string | undefined,
  viewport: "both" | "desktop" | "mobile",
  colorScheme: ColorScheme,
): readonly GeneratedComponentView[] {
  return resolveWorkspaceViews(data, variantId, viewport, colorScheme).views;
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
  const resolved = resolveWorkspaceViews(
    data,
    variantId,
    viewport,
    colorScheme,
  );
  const evidenceKey =
    data.entry.kind === "component" ? variantId : data.entry.id;
  const presentation = resolveViewPresentation({
    displayedViews: resolved.views,
    fallbackComparisonEligible: selection.comparisonEligible,
    fallbackStatus: selection.variant?.status ?? data.status,
    kind: data.entry.kind,
    states: evidenceKey ? data.viewStates[evidenceKey] : undefined,
  });
  return {
    ...resolved,
    comparisonEligible: !selection.error && presentation.comparisonEligible,
    evidence: presentation.evidence === "matching" ? "view" : "selection",
    status: presentation.status,
  };
}
