/** Saved-variant URL state and real fragment selection; no prop mutation. */
import type {
  WorkspaceData,
  WorkspaceVariant,
} from "../shell/workspace_data.js";

import {
  currentColorScheme,
  currentViewport,
  setColorScheme,
} from "./browse_state.js";
import { element } from "./inspector_panels.js";
import { applyShownStatus } from "./workspace_status.js";

export interface InstalledWorkspace {
  dispose(): void;
  setVariant(variantId: string | undefined): void;
}

export function selectedVariant(
  data: WorkspaceData,
  search: string,
): {
  variant?: WorkspaceVariant;
  error?: string;
  comparisonEligible: boolean;
} {
  if (data.entry.kind !== "component")
    return { comparisonEligible: data.comparisonEligible };
  const ids = new URLSearchParams(search).getAll("variant");
  if (ids.length > 1)
    return {
      error: "Choose one saved variant.",
      comparisonEligible: false,
    };
  const variant = ids.length
    ? data.variants.find((item) => item.value.id === ids[0])
    : data.variants[0];
  return variant
    ? { variant, comparisonEligible: variant.comparisonEligible }
    : {
        error: "This saved variant is unavailable. Choose another variant.",
        comparisonEligible: false,
      };
}

/** Resolve one host-owned variant value without changing browser history. */
export function selectedVariantValue(
  data: WorkspaceData,
  href: string,
  value: string | undefined,
): ReturnType<typeof selectedVariant> {
  const url = new URL(href);
  if (value) url.searchParams.set("variant", value);
  else url.searchParams.delete("variant");
  return selectedVariant(data, url.search);
}

/** Restore the committed value after a controlled host receives a proposal. */
export function syncVariantControl(
  root: HTMLElement,
  value: string | undefined,
): void {
  const selector = root.querySelector<HTMLSelectElement>(
    "[data-workspace-variant]",
  );
  if (selector) selector.value = value ?? "";
}

export function applyVariant(
  root: HTMLElement,
  data: WorkspaceData,
  variant: WorkspaceVariant | undefined,
  error?: string,
  options: { preservePreview?: boolean } = {},
): void {
  const doc = root.ownerDocument;
  const message = root.querySelector<HTMLElement>("[data-workspace-error]")!;
  message.hidden = !error;
  message.textContent = error ?? "";
  const selector = root.querySelector<HTMLSelectElement>(
    "[data-workspace-variant]",
  );
  if (selector) selector.value = variant?.value.id ?? "";
  const diff = root.querySelector<HTMLElement>("[data-diff-screen]");
  if (diff) diff.dataset["diffVariant"] = variant?.value.id ?? "";
  const variantStatus = root.querySelector<HTMLElement>(
    "[data-workspace-variant-status]",
  );
  if (variantStatus) {
    variantStatus.hidden = !variant?.status;
    variantStatus.textContent = variant?.status
      ? `${variant.value.title} · ${variant.status}`
      : "";
  }
  applyShownStatus(
    root,
    data,
    currentViewport(doc),
    currentColorScheme(doc),
    variant,
    error,
  );
  const preview =
    root.querySelector<HTMLElement>("[data-current-screen]") ??
    root.querySelector<HTMLElement>("[data-workspace-preview]")!;
  let empty = preview.querySelector<HTMLElement>("[data-workspace-empty]");
  if (!empty) {
    empty = element(doc, "div");
    empty.className = "mbk-empty";
    empty.dataset["workspaceEmpty"] = "";
    preview.append(empty);
  }
  empty.hidden = !error && !variant?.removed;
  empty.textContent = error
    ? "Choose a saved variant to see its preview."
    : "This variant was removed. Select a comparison to see its previous version.";
  const stage = preview.querySelector<HTMLElement>("[data-mokly-stage]");
  if (stage) stage.hidden = Boolean(error || variant?.removed);
  if (variant && !variant.removed && !options.preservePreview) {
    for (const frame of root.querySelectorAll<HTMLIFrameElement>(
      "iframe[data-workspace-frame]",
    )) {
      const viewport =
        frame.dataset["workspaceFrame"] === "mobile" ? "mobile" : "desktop";
      const path = (route: string) =>
        `/static/${route.split("/").map(encodeURIComponent).join("/")}`;
      frame.dataset["fragmentLight"] = path(variant.value.fragments[viewport]);
      const dark = variant.value.darkFragments?.[viewport];
      if (dark) frame.dataset["fragmentDark"] = path(dark);
      else delete frame.dataset["fragmentDark"];
      frame.title = `${data.entry.title} · ${variant.value.title} — ${viewport}`;
    }
    setColorScheme(doc, currentColorScheme(doc));
  }
}
