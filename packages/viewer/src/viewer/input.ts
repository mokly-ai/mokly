import type { CatalogueReadModel } from "../catalogue/types.js";
import { handleBrowseControl } from "../client/browse_controls.js";
import {
  handleFrameClick,
  handleAddressClick,
} from "../client/browse_frames.js";
import { copyText } from "../client/clipboard.js";
import { parseSearchQuery } from "../client/search_query.js";
import { handleTagControlClick } from "../client/tag_filter.js";

import { routedEntries } from "./selection.js";
import type { ViewerSelection } from "./types.js";

interface InputActions {
  doc: Document;
  model: CatalogueReadModel;
  baseUrl: URL;
  selection(): ViewerSelection;
  select(value: Partial<ViewerSelection>): void;
  navigate(id: string | null, url: URL): void;
  refresh(): void;
  updateDiffs(): void;
}
export function viewerInput(event: Event, actions: InputActions): void {
  const target = event.target instanceof Element ? event.target : undefined;
  if (!target) return;
  const { doc, model, baseUrl } = actions;
  const scheme = target.closest(
    "[data-workspace-scheme], [data-color-scheme-option]",
  );
  const viewport = target.closest(
    "[data-workspace-viewport], [data-viewport-option]",
  );
  if (
    (event.type === "click" && scheme) ||
    ((event.type === "change" ||
      (event.type === "click" &&
        viewport?.hasAttribute("data-viewport-option"))) &&
      viewport)
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
    actions.select(
      scheme
        ? {
            colorScheme:
              (scheme.getAttribute("data-color-scheme-option") as
                "light" | "dark") ??
              (actions.selection().colorScheme === "dark" ? "light" : "dark"),
          }
        : {
            viewport: (viewport?.getAttribute("data-viewport-option") ??
              (viewport as HTMLSelectElement)
                .value) as ViewerSelection["viewport"],
          },
    );
    actions.refresh();
    return;
  }
  if (event.type === "input" && target.matches("[data-mokly-search]")) {
    const query = parseSearchQuery((target as HTMLInputElement).value);
    actions.select({ search: query.freeText, tags: query.tags });
    actions.refresh();
    return;
  }
  if (event.type !== "click") return;
  if (handleTagControlClick(doc, target)) {
    const query = parseSearchQuery(
      doc.querySelector<HTMLInputElement>("[data-mokly-search]")?.value ?? "",
    );
    actions.select({ search: query.freeText, tags: query.tags });
    actions.refresh();
    return;
  }
  const filter = target.closest("[data-filter]");
  if (filter) {
    actions.select({
      view:
        filter.getAttribute("data-filter") === "changed" ? "changes" : "all",
    });
    actions.refresh();
    return;
  }
  if (
    handleBrowseControl(doc, target, actions.updateDiffs) ||
    handleFrameClick(doc, target) ||
    handleAddressClick(doc, target, (text) => copyText(doc, text))
  )
    return;
  const copy = target.closest("[data-copy-id]");
  if (copy) {
    copyText(doc, copy.getAttribute("data-copy-id") ?? "");
    return;
  }
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  if (
    (event instanceof MouseEvent &&
      (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) ||
    (link.target && link.target !== "_self")
  )
    return;
  const url = new URL(link.href, baseUrl);
  if (url.origin !== baseUrl.origin) return;
  const entry = routedEntries(model).find(
    (entry) =>
      url.pathname === `/view/${entry.route}` ||
      url.pathname === `/id/${entry.id}`,
  );
  if (!entry && url.pathname !== "/") return;
  event.preventDefault();
  actions.navigate(entry?.id ?? null, url);
}
