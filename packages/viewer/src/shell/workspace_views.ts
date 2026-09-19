/** Saved and temporary preview context selection for one workspace. */

import type { GeneratedComponentView } from "../components/views.js";

import type { WorkspaceData } from "./workspace_data.js";

/** Select the actual visible viewport and scheme contexts for a variant. */
export function visibleWorkspaceViews(
  data: WorkspaceData,
  variantId: string | undefined,
  viewport: "both" | "desktop" | "mobile",
  colorScheme: "dark" | "light",
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
