/** DOM rendering for isolated before/after views requested by the user. */

import type { ReviewResult, ViewReview } from "../review/types.js";

import { currentColorScheme, currentViewport } from "./browse_state.js";
import { entryWording } from "./entry_wording.js";
import { isStyleOnlyView } from "./style_evidence.js";

/** Available display modes; Current never requests a comparison. */
export type DiffMode = "current" | "side" | "overlay" | "difference";

/** A parsed comparison with its immutable snapshot base URL. */
export interface LoadedDiff {
  result: ReviewResult;
  url: string;
}

const STATE_LABELS = {
  added: "New screen",
  changed: "Screen changed",
  "ignored-only": "Only excluded content changed",
  removed: "Screen removed",
  unchanged: "No changes to this screen",
} as const;

const STYLE_LABEL = "Styles this screen uses changed";

/** Render the selected screen, viewport, and scheme without changing the shell. */
export function renderDiff(
  doc: Document,
  stage: HTMLElement,
  loaded: LoadedDiff,
  route: string,
  mode: DiffMode,
  variantId?: string,
): void {
  const component =
    loaded.result.schemaVersion === 3
      ? loaded.result.components.find((candidate) => candidate.route === route)
      : undefined;
  const variant = component?.variants.find(
    (candidate) => candidate.id === variantId,
  );
  const screen =
    component && variant
      ? { ...component, views: variant.views }
      : loaded.result.screens.find((candidate) => candidate.route === route);
  if (!screen) {
    stage.replaceChildren();
    stage.append(message(doc, "This screen has no comparison available."));
    return;
  }
  const viewport = currentViewport(doc);
  const scheme = currentColorScheme(doc);
  const key = `${loaded.url}|${route}|${variantId ?? ""}|${viewport}|${scheme}`;
  if (stage.dataset["diffKey"] === key && stage.querySelector(".mb-panes")) {
    for (const panes of stage.querySelectorAll<HTMLElement>(".mb-panes")) {
      panes.dataset["compareMode"] = panes.querySelector(".mb-pane-missing")
        ? "side"
        : mode;
    }
    return;
  }
  stage.replaceChildren();
  stage.dataset["diffKey"] = key;
  const wording = entryWording(component ? "component" : "screen");
  for (const size of ["mobile", "desktop"] as const) {
    if (viewport !== "both" && viewport !== size) continue;
    const view =
      screen.views.find(
        (item) => item.viewport === size && item.colorScheme === scheme,
      ) ??
      screen.views.find(
        (item) => item.viewport === size && item.colorScheme === "light",
      );
    if (!view) continue;
    const section = doc.createElement("section");
    section.className = `mbk-diff-view mbk-diff-${size}`;
    section.dataset["diffViewport"] = size;
    const heading = doc.createElement("h3");
    const label = isStyleOnlyView(view)
      ? STYLE_LABEL
      : STATE_LABELS[view.state];
    heading.textContent = `${size === "mobile" ? "Mobile" : "Desktop"} · ${wording.label(label)}${scheme !== view.colorScheme ? " · Light only" : ""}`;
    section.append(heading);
    const panes = doc.createElement("div");
    panes.className = "mb-panes";
    panes.dataset["compareMode"] =
      view.beforePath && view.afterPath ? mode : "side";
    panes.append(
      pane(doc, loaded.url, view, "before"),
      pane(doc, loaded.url, view, "after"),
    );
    section.append(panes);
    stage.append(section);
  }
}

function pane(
  doc: Document,
  base: string,
  view: ViewReview,
  side: "before" | "after",
): HTMLElement {
  const container = doc.createElement("div");
  container.className = `mb-pane mb-pane--${side}`;
  const label = doc.createElement("p");
  label.className = "mb-pane-label";
  label.textContent = side === "before" ? "Before" : "Current";
  container.append(label);
  const source = side === "before" ? view.beforePath : view.afterPath;
  if (!source) {
    const missing = message(
      doc,
      side === "before"
        ? "This screen was added on this branch."
        : "This screen was removed on this branch.",
    );
    missing.className = "mb-pane-missing";
    container.append(missing);
    return container;
  }
  const body = doc.createElement("div");
  body.className = "mb-pane-doc mbk-frame-wrap";
  if (view.colorScheme === "light")
    body.setAttribute("data-color-scheme-fallback", "");
  const frame = doc.createElement("iframe");
  frame.className = "mbk-frag";
  frame.title = `${label.textContent} — ${view.viewport} — ${view.colorScheme}`;
  frame.setAttribute("sandbox", "");
  frame.src = new URL(
    source.split("/").map(encodeURIComponent).join("/"),
    base,
  ).href;
  const template = doc.querySelector<HTMLTemplateElement>(
    `[data-diff-template="${view.viewport}"]`,
  );
  const chrome = template?.content.firstElementChild?.cloneNode(true) as
    HTMLElement | undefined;
  const viewport = chrome?.querySelector(".phone-screen, .browser-viewport");
  if (chrome && viewport) {
    viewport.append(frame);
    body.append(chrome);
  } else body.append(frame);
  container.append(body);
  return container;
}

function message(doc: Document, text: string): HTMLElement {
  const paragraph = doc.createElement("p");
  paragraph.textContent = text;
  return paragraph;
}
