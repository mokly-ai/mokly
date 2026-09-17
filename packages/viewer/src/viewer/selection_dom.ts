import {
  applyNavVisibility,
  selectAndRevealRoute,
} from "../client/browse_navigation_state.js";
import { setViewport } from "../client/browse_state.js";
import { syncTagChips } from "../client/tag_filter.js";

import { selectionQuery } from "./selection.js";
import type { ViewerSelection } from "./types.js";

/** Apply only shell state; adapters own frame document replacement. */
export function syncSelection(
  doc: Document,
  selection: ViewerSelection,
  destination?: URL,
): void {
  setViewport(doc, selection.viewport);
  doc.body.dataset["moklyColorScheme"] = selection.colorScheme;
  for (const option of doc.querySelectorAll(
    "[data-color-scheme-option], [data-workspace-scheme]",
  ))
    option.setAttribute(
      "aria-pressed",
      String(
        option.hasAttribute("data-workspace-scheme")
          ? selection.colorScheme === "dark"
          : option.getAttribute("data-color-scheme-option") ===
              selection.colorScheme,
      ),
    );
  const input = doc.querySelector<HTMLInputElement>("[data-mokly-search]");
  if (input) input.value = selectionQuery(selection);
  for (const option of doc.querySelectorAll("[data-filter]"))
    option.setAttribute(
      "aria-pressed",
      String(
        option.getAttribute("data-filter") ===
          (selection.view === "changes" ? "changed" : "all"),
      ),
    );
  applyNavVisibility(doc, "reveal-matches");
  if (destination)
    selectAndRevealRoute(
      doc,
      destination.pathname,
      destination.href,
      "navigation",
    );
  syncTagChips(doc);
  const viewport = doc.querySelector<HTMLSelectElement>(
    "[data-workspace-viewport]",
  );
  if (viewport) viewport.value = selection.viewport;
}
