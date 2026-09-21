import type { CatalogueReadModel } from "../catalogue/types.js";
import { handleBrowseControl } from "../client/browse_controls.js";
import {
  handleFrameClick,
  handleAddressClick,
} from "../client/browse_frames.js";
import { changesActivation } from "../client/changes_activation.js";
import { copyText } from "../client/clipboard.js";
import { parseSearchQuery } from "../client/search_query.js";
import { handleTagControlClick } from "../client/tag_filter.js";

import { publishedChangedViews } from "./public_workspace.js";
import { routedEntries } from "./selection.js";
import type { ViewerSelection } from "./types.js";

interface InputActions {
  doc: Document;
  model: CatalogueReadModel;
  baseUrl: URL;
  selection(): ViewerSelection;
  select(value: Partial<ViewerSelection>): void;
  navigate(
    id: string | null,
    url: URL,
    axes?: Pick<ViewerSelection, "viewport" | "colorScheme">,
  ): void;
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
    handleBrowseControl(doc, target, {
      rememberDisclosures: () => {},
      updateDiffs: actions.updateDiffs,
    }) ||
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
  let url = new URL(link.href, baseUrl);
  if (url.origin !== baseUrl.origin) return;
  const resolve = (destination: URL) =>
    routedEntries(model).find(
      (entry) =>
        destination.pathname === `/view/${entry.route}` ||
        destination.pathname === `/id/${entry.id}`,
    );
  let entry = resolve(url);
  const preliminary = changesActivation(link);
  if (preliminary) {
    url = new URL(preliminary.href, baseUrl);
    entry = resolve(url);
  }
  const views =
    entry?.kind === "screen"
      ? entry.views
      : entry?.kind === "component"
        ? (entry.variants[0]?.views ?? [])
        : [];
  const activation = changesActivation(link, publishedChangedViews(views));
  if (activation) url = new URL(activation.href, baseUrl);
  entry = resolve(url);
  if (!entry && url.pathname !== "/") return;
  event.preventDefault();
  actions.navigate(
    entry?.id ?? null,
    url,
    activation?.viewport && activation.scheme
      ? {
          viewport: activation.viewport,
          colorScheme: activation.scheme,
        }
      : undefined,
  );
}
