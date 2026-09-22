/** Saved and temporary preview context selection for one workspace. */

import type { GeneratedComponentView } from "../components/views.js";

import type { WorkspaceData } from "./workspace_data.js";

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
  colorScheme: "dark" | "light",
): readonly GeneratedComponentView[] {
  return resolveWorkspaceViews(data, variantId, viewport, colorScheme).views;
}
