/** Shared controls panel chrome; fields and readonly values have stable DOM homes. */
import type {
  WorkspaceData,
  WorkspaceVariant,
} from "../shell/workspace_data.js";

import { element } from "./inspector_panels.js";

export function controlSurface(
  doc: Document,
  reset: () => void,
  retryEdit: () => void,
) {
  const panel = element(doc, "div");
  panel.className = "mbk-component-controls";
  const form = element(doc, "div");
  const status = element(doc, "p");
  status.setAttribute("role", "status");
  status.dataset["controlsStatus"] = "";
  const error = element(doc, "p");
  error.className = "mbk-control-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const resetButton = element(doc, "button", "Reset");
  resetButton.type = "button";
  resetButton.className = "mbk-chip";
  const retry = element(doc, "button", "Try again");
  retry.type = "button";
  retry.className = "mbk-chip";
  retry.hidden = true;
  const propsPanel = element(doc, "div");
  const actions = element(doc, "div");
  actions.className = "mbk-control-actions";
  actions.append(status, retry, resetButton);
  panel.append(form, error, actions, propsPanel);
  resetButton.addEventListener("click", reset);
  retry.addEventListener("click", retryEdit);
  return { panel, form, status, error, resetButton, retry, propsPanel };
}

/** Explain the capability boundary without advertising unavailable actions. */
export function controlsUnavailable(
  data: WorkspaceData,
  variant: WorkspaceVariant | undefined,
  comparing: boolean,
): string | undefined {
  if (!variant || variant.removed)
    return "Choose an available saved variant to edit props.";
  if (comparing)
    return "Comparisons show the saved variant. Return to Current to edit props.";
  if (!data.renderCapability)
    return "Open this catalogue locally to edit props.";
  if (
    data.entry.kind === "component" &&
    !Object.keys(data.entry.controls).length
  )
    return "No editable props are declared for this component.";
}
