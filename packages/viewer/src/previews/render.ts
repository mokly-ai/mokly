/** DOM for the previous-version stage: its states and its historical frames. */

import type { ColorScheme, Viewport } from "../data/axes.js";
import type { RemovedPreviewData } from "../shell/previews.js";

import type { PreviewContent, PreviewScreenView } from "./request.js";

/** Marks every frame holding historical bytes, for read-only enforcement. */
export const PREVIEW_FRAME_ATTRIBUTE = "data-mokly-preview-frame";

/** Activates another attempt after the previous version could not be loaded. */
export const PREVIEW_RETRY_ATTRIBUTE = "data-mokly-preview-retry";

/** The viewport choice the stage currently shows. */
export function previewViewport(host: Element): Viewport | "both" {
  const value = host.getAttribute("data-viewport");
  return value === "mobile" || value === "desktop" ? value : "both";
}

/** The color scheme choice the shell currently shows. */
export function previewColorScheme(doc: Document): ColorScheme {
  return doc.body.getAttribute("data-mokly-color-scheme") === "dark"
    ? "dark"
    : "light";
}

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  return node;
}

function stage(doc: Document, child: HTMLElement): HTMLElement {
  const surface = element(doc, "div", "mbk-stage");
  surface.append(child);
  return surface;
}

/** Show that the previous version is on its way. */
export function renderPreviewLoading(doc: Document, host: Element): void {
  const state = element(doc, "div", "mbk-preview-state");
  const status = element(doc, "p", "mbk-preview-status");
  status.setAttribute("role", "status");
  const spinner = element(doc, "span", "mbk-preview-spinner");
  spinner.setAttribute("aria-hidden", "true");
  status.append(spinner, "Loading previous version…");
  state.append(status);
  host.replaceChildren(stage(doc, state));
}

/** Say that nothing could be shown, and offer another attempt. */
export function renderPreviewUnavailable(doc: Document, host: Element): void {
  const empty = element(doc, "div", "mbk-empty");
  const heading = element(doc, "h2");
  heading.textContent = "Previous version unavailable";
  const body = element(doc, "p");
  body.textContent = "The previous version could not be loaded.";
  const retry = element(doc, "button", "mbk-empty-link");
  retry.type = "button";
  retry.setAttribute(PREVIEW_RETRY_ATTRIBUTE, "");
  retry.textContent = "Retry";
  empty.append(heading, body, retry);
  host.replaceChildren(stage(doc, empty));
}

function previewFrame(doc: Document, src: string, title: string) {
  const frame = element(doc, "iframe", "mbk-frag");
  frame.setAttribute(PREVIEW_FRAME_ATTRIBUTE, "");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.title = title;
  frame.src = src;
  return frame;
}

function chromed(
  doc: Document,
  viewport: Viewport,
  frame: HTMLIFrameElement,
): HTMLElement {
  const template = doc.querySelector<HTMLTemplateElement>(
    `[data-mokly-preview-template="${viewport}"]`,
  );
  const chrome = template?.content.firstElementChild?.cloneNode(true) as
    HTMLElement | undefined;
  const slot = chrome?.querySelector(".phone-screen, .browser-viewport");
  if (!chrome || !slot) return frame;
  slot.append(frame);
  return chrome;
}

function screenFrame(
  doc: Document,
  data: RemovedPreviewData,
  viewport: Viewport,
  view: PreviewScreenView,
  scheme: ColorScheme,
): HTMLElement {
  const wrap = element(
    doc,
    "div",
    `mbk-frame-wrap mbk-frame-${viewport === "mobile" ? "mobile" : "desktop"}`,
  );
  if (view.colorScheme !== scheme)
    wrap.setAttribute("data-color-scheme-fallback", "");
  const label = element(doc, "p", "mbk-frame-label");
  label.textContent = viewport === "mobile" ? "Mobile" : "Desktop";
  if (view.colorScheme !== scheme) {
    const note = element(doc, "span", "mbk-frame-scheme-note");
    note.textContent = " — Light only";
    label.append(note);
  }
  wrap.append(
    label,
    chromed(
      doc,
      viewport,
      previewFrame(doc, view.url, `${data.title} — ${viewport}`),
    ),
  );
  return wrap;
}

/**
 * Render the historical documents. A page keeps the plain document pane; a
 * screen keeps its device frames, showing only the views that were captured.
 */
export function renderPreviewContent(
  doc: Document,
  host: Element,
  data: RemovedPreviewData,
  content: PreviewContent,
): readonly HTMLIFrameElement[] {
  if (content.kind === "page") {
    const pane = element(doc, "div", "mbk-stage-embed");
    pane.setAttribute("data-mokly-scroll", "embed");
    const frame = previewFrame(doc, content.url, data.title);
    pane.append(frame);
    host.replaceChildren(pane);
    return [frame];
  }
  const viewport = previewViewport(host);
  const scheme = previewColorScheme(doc);
  const surface = element(doc, "div", "mbk-stage mbk-live");
  surface.setAttribute("data-mokly-scroll", "stage");
  surface.setAttribute("data-viewport", viewport);
  for (const size of ["mobile", "desktop"] as const) {
    if (viewport !== "both" && viewport !== size) continue;
    const view =
      content.views.find(
        (item) => item.viewport === size && item.colorScheme === scheme,
      ) ??
      content.views.find(
        (item) => item.viewport === size && item.colorScheme === "light",
      );
    if (view) surface.append(screenFrame(doc, data, size, view, scheme));
  }
  host.replaceChildren(surface);
  return [...host.querySelectorAll("iframe")];
}
