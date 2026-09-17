import type { GeneratedComponentView } from "../components/views.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

/** Adapter-backed inspection supplied by an embedding host's runtime. */
export interface WorkspaceInspection {
  workspaceHighlight(
    selected: string | undefined,
    choose: (key: string, viewport: "mobile" | "desktop") => void,
  ): () => void;
  workspaceReveal(key: string, viewport: "mobile" | "desktop"): void;
}

export function workspaceInstanceLabel(
  data: WorkspaceData,
  views: readonly GeneratedComponentView[],
  key: string,
): string {
  const instance = views
    .flatMap((value) => value.usage?.instances ?? [])
    .find((item) => item.key === key);
  return `${data.components.find((item) => item.id === instance?.componentId)?.title ?? "Component"} · ${instance?.id ?? ""}`;
}
export function adapterHighlightUnavailable(
  views: readonly GeneratedComponentView[],
  comparison: boolean,
): string | undefined {
  if (comparison) return "Choose Current to inspect components.";
  if (views.some((view) => !view.usage))
    return "Component inspection is unavailable in this view.";
}

export function configureHighlight(
  button: HTMLButtonElement,
  reason: string | undefined,
  highlight: boolean,
): boolean {
  button.disabled = reason !== undefined;
  button.title = reason ?? "Highlight components";
  button.setAttribute(
    "aria-description",
    reason ?? "Inspect component regions and their supplied props.",
  );
  if (reason && reason !== "Waiting for the component preview.")
    highlight = false;
  button.setAttribute("aria-pressed", String(highlight));
  return highlight;
}
