/** Delegated controls for the persistent navigation and preview chrome. */
import { applyNavVisibility } from "./browse_navigation_state.js";
import { setColorScheme, setDrawer, setViewport } from "./browse_state.js";
import {
  isDisclosureOpen,
  navDisclosures,
  setDisclosureOpen,
} from "./disclosures.js";

/** Side effects the delegated shell controls hand back to Browse. */
export interface BrowseControlActions {
  /**
   * Persist the current disclosure set. A native group reaches the same
   * preference through its `toggle` event; the variant list has no such event,
   * so its button reports the change here instead.
   */
  rememberDisclosures(): void;
  updateDiffs(): void;
}

export function handleBrowseControl(
  doc: Document,
  target: Element,
  actions: BrowseControlActions,
): boolean {
  if (target.closest("[data-mokly-menu]")) {
    const shell = doc.querySelector<HTMLElement>("[data-mokly-shell]");
    if (shell) setDrawer(shell, shell.dataset["drawer"] !== "open");
    return true;
  }
  if (target.closest("[data-mokly-collapse]")) {
    for (const group of navDisclosures(doc)) setDisclosureOpen(group, false);
    return true;
  }
  const variants = target.closest<HTMLElement>("[data-nav-variants-toggle]");
  if (variants) {
    const listId = variants.getAttribute("aria-controls");
    const list = listId === null ? null : doc.getElementById(listId);
    if (list) {
      setDisclosureOpen(list, !isDisclosureOpen(list));
      if (list.dataset["filterOpen"] === undefined)
        actions.rememberDisclosures();
    }
    return true;
  }
  const scheme = target
    .closest("[data-color-scheme-option]")
    ?.getAttribute("data-color-scheme-option");
  if (scheme === "dark" || scheme === "light") {
    setColorScheme(doc, scheme);
    actions.updateDiffs();
    return true;
  }
  const viewport = target
    .closest("[data-viewport-option]")
    ?.getAttribute("data-viewport-option");
  if (viewport) {
    setViewport(doc, viewport);
    actions.updateDiffs();
    return true;
  }
  const filter = target.closest("[data-filter]");
  if (filter) {
    for (const option of doc.querySelectorAll("[data-filter]"))
      option.setAttribute("aria-pressed", String(option === filter));
    applyNavVisibility(doc, "reveal-matches");
    return true;
  }
  return false;
}
