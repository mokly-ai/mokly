/** Keep the title status and comparison band aligned with the shown view. */
import type { ColorScheme, Viewport } from "../data/axes.js";
import {
  shownComparisonEligible,
  shownStatus,
  type EntryStatus,
} from "../shell/view_status.js";
import type {
  WorkspaceData,
  WorkspaceVariant,
} from "../shell/workspace_data.js";

/** Resolve the shown status for one screen or selected component saved variant. */
export function selectedShownStatus(
  data: WorkspaceData,
  viewport: "both" | Viewport,
  scheme: ColorScheme,
  variant: WorkspaceVariant | undefined,
): EntryStatus | undefined {
  const key =
    data.entry.kind === "component" ? variant?.value.id : data.entry.id;
  const fallback =
    data.entry.kind === "component" && variant?.removed
      ? "Removed"
      : data.status;
  return shownStatus(
    key === undefined ? undefined : data.viewStates[key],
    viewport,
    scheme,
    fallback,
  );
}

/** Preserve comparison availability only for a valid shown selection. */
export function selectedComparisonEligible(
  data: WorkspaceData,
  status: EntryStatus | undefined,
  variant: WorkspaceVariant | undefined,
  error?: string,
): boolean {
  if (error) return false;
  if (status !== undefined)
    return shownComparisonEligible(status, data.entry.kind);
  return data.entry.kind === "component"
    ? (variant?.comparisonEligible ?? false)
    : data.comparisonEligible;
}

/** Write the shown status and band, returning to Current before hiding it. */
export function applyShownStatus(
  root: HTMLElement,
  data: WorkspaceData,
  viewport: "both" | Viewport,
  scheme: ColorScheme,
  variant: WorkspaceVariant | undefined,
  error?: string,
): boolean {
  const status = selectedShownStatus(data, viewport, scheme, variant);
  const badge = root.querySelector<HTMLElement>("[data-workspace-status]")!;
  if (status) badge.setAttribute("data-status", status);
  else badge.removeAttribute("data-status");
  badge.textContent = status ?? "";
  badge.hidden = status === undefined;

  const eligible = selectedComparisonEligible(data, status, variant, error);
  const toolbar = root.querySelector<HTMLElement>(".mbk-diff-toolbar");
  if (toolbar) {
    const current = root.querySelector<HTMLButtonElement>(
      '[data-diff-mode="current"]',
    );
    if (!eligible && current?.getAttribute("aria-pressed") === "false")
      current.click();
    toolbar.hidden = !eligible;
  }
  return eligible;
}
