/** Merge catalogue evidence without replacing live previews, props controls, or selections. */
import type { WorkspaceData } from "../shell/workspace_data.js";

import { copyChildren } from "./browse_evidence.js";
import { captureRegionScrolls, restoreRegionScrolls } from "./browse_state.js";
import { renderUsage } from "./inspector_panels.js";
import { renderWorkspaceEvidence } from "./workspace_evidence.js";
import { applyVariant, selectedVariant } from "./workspace_variants.js";

/** Validate the owning workspace before any part of a snapshot is applied. */
export function workspaceEvidence(
  doc: Document,
  next: Document,
): (() => void) | undefined {
  const root = doc.querySelector<HTMLElement>("[data-workspace]");
  const incoming = next.querySelector("[data-workspace-data]")?.textContent;
  if (!root && !incoming) return () => {};
  if (!root || !incoming) return;
  try {
    const previous = JSON.parse(
      root.querySelector("[data-workspace-data]")?.textContent ?? "",
    ) as WorkspaceData;
    const data = JSON.parse(incoming) as WorkspaceData;
    if (
      data.entry.id !== previous.entry.id ||
      data.entry.kind !== previous.entry.kind ||
      data.removed !== previous.removed
    )
      return;
    return () =>
      root.dispatchEvent(
        new doc.defaultView!.CustomEvent("mokly:workspace-evidence", {
          detail: data,
        }),
      );
  } catch {
    return undefined;
  }
}

/** Keep on-demand usage matched to the documents already shown, not exhaustive render order. */
export function mergeWorkspaceEvidence(
  current: WorkspaceData,
  next: WorkspaceData,
): void {
  const views = current.views;
  const generation = current.previewGeneration;
  for (const key of [
    "status",
    "change",
    "comparison",
    "resourceEvidence",
    "usageComplete",
    "previewGeneration",
    "renderCapability",
  ] as const)
    delete current[key];
  Object.assign(current, next);
  if (generation && generation === next.previewGeneration) {
    current.views = next.views.map((view) => {
      const retained = views.find(
        (previous) => previous.path === view.path,
      )?.usage;
      const merged = { ...view };
      delete merged.usage;
      return retained ? { ...merged, usage: retained } : merged;
    });
  }
}

/** Update only evidence-owned surfaces, leaving editable props and preview state intact. */
export function updateWorkspaceEvidence(
  root: HTMLElement,
  data: WorkspaceData,
  search: string,
): ReturnType<typeof selectedVariant> {
  const doc = root.ownerDocument;
  const scrolls = captureRegionScrolls(doc);
  const selected = selectedVariant(data, search);
  const selector = root.querySelector<HTMLSelectElement>(
    "[data-workspace-variant]",
  );
  if (selector) {
    const remaining = new Map(
      data.variants.map((variant) => [variant.value.id, variant]),
    );
    for (const option of [...selector.options]) {
      const variant = remaining.get(option.value);
      if (!variant) option.remove();
      else {
        option.textContent = `${variant.value.title}${variant.removed ? " · Removed" : ""}`;
        remaining.delete(option.value);
      }
    }
    for (const variant of remaining.values()) {
      const option = doc.createElement("option");
      option.value = variant.value.id;
      option.textContent = `${variant.value.title}${variant.removed ? " · Removed" : ""}`;
      selector.append(option);
    }
  }
  applyVariant(root, data, selected.variant, selected.error, {
    preservePreview: true,
  });
  const usage = root.querySelector<HTMLElement>(
    '[data-inspector-panel="usage"]',
  );
  if (usage) updateUsage(usage, data);
  const evidence = doc.createElement("div");
  renderWorkspaceEvidence(evidence, data, selected.variant?.value.id);
  const panel = root.querySelector<HTMLElement>("[data-workspace-evidence]");
  copyChildren(panel, evidence);
  if (panel) panel.hidden = evidence.hidden;
  const json = root.querySelector("[data-workspace-data]");
  if (json) json.textContent = JSON.stringify(data);
  restoreRegionScrolls(doc, scrolls);
  return selected;
}

/** Reconcile independently changing Usage sections without remounting their links. */
function updateUsage(panel: HTMLElement, data: WorkspaceData): void {
  const expected = panel.ownerDocument.createElement("div");
  renderUsage(expected, data);
  const sections = new Map(
    [...panel.children].map((section) => [usageKey(section), section]),
  );
  let position = panel.firstElementChild;
  for (const next of [...expected.children]) {
    const key = usageKey(next);
    const current = sections.get(key);
    if (current?.tagName === next.tagName) {
      if (current instanceof HTMLElement && next instanceof HTMLElement)
        updateUsageSection(current, next);
      sections.delete(key);
      if (current === position) position = position.nextElementSibling;
      else panel.insertBefore(current, position);
    } else {
      const inserted = panel.ownerDocument.importNode(next, true);
      panel.insertBefore(inserted, position);
    }
  }
  for (const stale of sections.values()) stale.remove();
}

function updateUsageSection(current: HTMLElement, next: HTMLElement): void {
  const currentList = current.querySelector<HTMLUListElement>(
    ":scope > .mbk-usage-list",
  );
  const nextList = next.querySelector<HTMLUListElement>(
    ":scope > .mbk-usage-list",
  );
  if (!currentList || !nextList) {
    copyChildren(current, next);
    return;
  }
  const heading = current.querySelector(":scope > h3");
  const nextHeading = next.querySelector(":scope > h3");
  if (heading && nextHeading && heading.textContent !== nextHeading.textContent)
    heading.textContent = nextHeading.textContent;
  updateUsageLinks(currentList, nextList);
}

function updateUsageLinks(
  current: HTMLUListElement,
  next: HTMLUListElement,
): void {
  const rows = new Map(
    [...current.children].map((row) => [usageKey(row), row]),
  );
  let position = current.firstElementChild;
  for (const nextRow of [...next.children]) {
    const key = usageKey(nextRow);
    const row = rows.get(key);
    if (row instanceof HTMLLIElement && nextRow instanceof HTMLLIElement) {
      updateUsageLink(row, nextRow);
      rows.delete(key);
      if (row === position) position = position.nextElementSibling;
      else current.insertBefore(row, position);
    } else {
      const inserted = current.ownerDocument.importNode(nextRow, true);
      current.insertBefore(inserted, position);
    }
  }
  for (const stale of rows.values()) stale.remove();
}

function updateUsageLink(current: HTMLLIElement, next: HTMLLIElement): void {
  const link = current.querySelector(":scope > a");
  const nextLink = next.querySelector(":scope > a");
  const details = current.querySelector(":scope > small");
  const nextDetails = next.querySelector(":scope > small");
  if (!link || !nextLink || !details || !nextDetails) {
    copyChildren(current, next);
    return;
  }
  if (link.getAttribute("href") !== nextLink.getAttribute("href"))
    link.setAttribute("href", nextLink.getAttribute("href")!);
  if (link.textContent !== nextLink.textContent)
    link.textContent = nextLink.textContent;
  if (details.textContent !== nextDetails.textContent)
    details.textContent = nextDetails.textContent;
}

function usageKey(element: Element): string {
  return (
    element.getAttribute("data-usage-section") ??
    element.getAttribute("data-usage-link") ??
    ""
  );
}
