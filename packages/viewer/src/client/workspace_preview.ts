/** Match saved view contexts and authenticated live documents for inspection. */
import type { GeneratedComponentView } from "../components/views.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import { currentColorScheme, currentViewport } from "./browse_state.js";
import type { HighlightFrame } from "./component_highlight.js";
import { element } from "./inspector_panels.js";
import { localInspection, localFrameReady } from "./same_origin_adapter.js";

export function workspaceViews(
  doc: Document,
  data: WorkspaceData,
  variantId?: string,
): readonly GeneratedComponentView[] {
  const views = data.views.filter((view) => view.variantId === variantId);
  const scheme = currentColorScheme(doc);
  const viewport = currentViewport(doc);
  return (["mobile", "desktop"] as const)
    .filter((size) => viewport === "both" || viewport === size)
    .flatMap((size) => {
      const view =
        views.find(
          (item) => item.viewport === size && item.colorScheme === scheme,
        ) ??
        views.find(
          (item) => item.viewport === size && item.colorScheme === "light",
        );
      return view ? [view] : [];
    });
}
export function workspaceFrames(
  root: HTMLElement,
  views: readonly GeneratedComponentView[],
): HighlightFrame[] {
  return views.flatMap((value) => {
    const frame = root.querySelector<HTMLIFrameElement>(
      `iframe[data-workspace-frame="${value.viewport}"]`,
    );
    return frame &&
      value.usage &&
      localInspection(frame, value.path, value.usage)
      ? [{ frame, path: value.path, usage: value.usage }]
      : [];
  });
}

/** Reveal a selected instance inside its authenticated current document. */
export function revealWorkspaceInstance(
  root: HTMLElement,
  viewport: "mobile" | "desktop",
  view: GeneratedComponentView | undefined,
  key: string,
): void {
  const frame = root.querySelector<HTMLIFrameElement>(
    `iframe[data-workspace-frame="${viewport}"]`,
  );
  if (!frame || !view?.usage) return;
  localInspection(frame, view.path, view.usage)?.reveal(key);
}
export function highlightUnavailable(
  root: HTMLElement,
  views: readonly GeneratedComponentView[],
  frames: readonly HighlightFrame[],
  invalidSelection: boolean,
): string | undefined {
  const mode = root
    .querySelector('[data-diff-mode][aria-pressed="true"]')
    ?.getAttribute("data-diff-mode");
  if (mode && mode !== "current")
    return "Highlighting is available in Current.";
  if (invalidSelection) return "This preview is unavailable.";
  if (!views.some((view) => view.usage))
    return "Component inspection is unavailable for this view.";
  if (!views.some((view) => view.usage?.instances.length))
    return "No registered components are used in this view.";
  if (frames.length !== views.length) {
    const invalid = views.some((view) => {
      const frame = root.querySelector<HTMLIFrameElement>(
        `iframe[data-workspace-frame="${view.viewport}"]`,
      );
      try {
        return (
          frame &&
          localFrameReady(frame, view.path) &&
          !frames.some((item) => item.frame === frame)
        );
      } catch {
        return true;
      }
    });
    return invalid
      ? "Component inspection is unavailable for this view."
      : "Waiting for the component preview.";
  }
}

/** Keep the inspector selection independent for each visible viewport. */
export function renderViewContexts(
  panel: HTMLElement,
  views: readonly GeneratedComponentView[],
  activeViewport: "mobile" | "desktop",
  select: (viewport: "mobile" | "desktop") => void,
): void {
  if (views.length < 2) return;
  for (const context of [...views].reverse()) {
    const button = element(
      panel.ownerDocument,
      "button",
      `${context.viewport === "mobile" ? "Mobile" : "Desktop"} · ${context.colorScheme}`,
    );
    button.type = "button";
    button.className = "mbk-instance-context mbk-chip";
    button.setAttribute(
      "aria-pressed",
      String(context.viewport === activeViewport),
    );
    button.addEventListener("click", () => select(context.viewport));
    panel.prepend(button);
  }
}
