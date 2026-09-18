/** Delegated controls for the persistent navigation and preview chrome. */
import { applyNavVisibility } from "./browse_navigation_state.js";
import { setColorScheme, setDrawer, setViewport } from "./browse_state.js";

export function handleBrowseControl(
  doc: Document,
  target: Element,
  updateDiffs: () => void,
): boolean {
  if (target.closest("[data-mokly-menu]")) {
    const shell = doc.querySelector<HTMLElement>("[data-mokly-shell]");
    if (shell) setDrawer(shell, shell.dataset["drawer"] !== "open");
    return true;
  }
  if (target.closest("[data-mokly-collapse]")) {
    for (const group of doc.querySelectorAll<HTMLDetailsElement>(
      "details[data-nav-disclosure]",
    ))
      group.open = false;
    return true;
  }
  const scheme = target
    .closest("[data-color-scheme-option]")
    ?.getAttribute("data-color-scheme-option");
  if (scheme === "dark" || scheme === "light") {
    setColorScheme(doc, scheme);
    updateDiffs();
    return true;
  }
  const viewport = target
    .closest("[data-viewport-option]")
    ?.getAttribute("data-viewport-option");
  if (viewport) {
    setViewport(doc, viewport);
    updateDiffs();
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
