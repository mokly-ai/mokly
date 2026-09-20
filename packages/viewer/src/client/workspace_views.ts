/**
 * The workspace's two view axes in the browser: the controls that select them,
 * the marks that point at changed views the reader cannot currently see, and
 * the view an arrival from the Changes filter opens on. The viewport and
 * scheme both change without a page load, so every mark is recomputed from the
 * same rule the server rendered rather than trusted from the markup.
 */

import type { ColorScheme, Viewport } from "../data/axes.js";
import {
  changedViewsLabel,
  VIEW_CHANGED_IDS,
  viewMarks,
} from "../shell/view_marks.js";
import type { WorkspaceData } from "../shell/workspace_data.js";

import { consumeChangesLanding } from "./browse_landing.js";
import {
  currentColorScheme,
  currentViewport,
  setColorScheme,
  setViewport,
} from "./browse_state.js";

const VIEWPORT_VALUES: readonly string[] = ["both", "desktop", "mobile"];
const CONTROLS = {
  scheme: "[data-workspace-scheme]",
  viewport: "[data-workspace-viewport]",
} as const;

/** Reveal or hide one control's dot, its wording, and the control's reference
 * to that wording together, so a screen reader never hears a stale mark. */
function applyViewMark(
  root: HTMLElement,
  kind: "scheme" | "viewport",
  marked: boolean,
): void {
  const dot = root.querySelector<HTMLElement>(`[data-view-changed="${kind}"]`);
  const text = root.querySelector<HTMLElement>(
    `[data-view-changed-text="${kind}"]`,
  );
  if (dot) dot.hidden = !marked;
  if (text) text.hidden = !marked;
  const control = root.querySelector<HTMLElement>(CONTROLS[kind]);
  if (!control) return;
  if (marked) control.setAttribute("aria-describedby", VIEW_CHANGED_IDS[kind]);
  else control.removeAttribute("aria-describedby");
}

/** Apply the changed views to both marks and to the Details row that names them. */
export function applyViewEvidence(
  root: HTMLElement,
  data: WorkspaceData,
  viewport: "both" | Viewport,
  scheme: ColorScheme,
): void {
  const marks = viewMarks(data.changedViews, viewport, scheme);
  applyViewMark(root, "scheme", marks.scheme);
  applyViewMark(root, "viewport", marks.viewport);
  const label = changedViewsLabel(data.changedViews);
  const value = root.querySelector<HTMLElement>(
    "[data-workspace-changed-views-value]",
  );
  if (value) value.textContent = label;
  const row = root.querySelector<HTMLElement>("[data-workspace-changed-views]");
  if (row) row.hidden = label === "";
}

/** Match the controls and their evidence to the view the stage now shows. */
export function syncViewControls(
  doc: Document,
  root: HTMLElement,
  data: WorkspaceData,
): void {
  const viewport = currentViewport(doc);
  const scheme = currentColorScheme(doc);
  const select = root.querySelector<HTMLSelectElement>(CONTROLS.viewport);
  if (select) select.value = viewport;
  root
    .querySelector(CONTROLS.scheme)
    ?.setAttribute("aria-pressed", String(scheme === "dark"));
  applyViewEvidence(root, data, viewport, scheme);
}

/**
 * Choose the view this install opens on. A URL that names either axis is an
 * explicit request and wins outright; otherwise an arrival recorded by the
 * Changes filter opens the first changed view. The intent is consumed either
 * way, so it can never apply to a later page.
 */
export function applyInitialView(
  doc: Document,
  win: Window & typeof globalThis,
  data: WorkspaceData,
): void {
  const landing = consumeChangesLanding(win);
  const query = new URLSearchParams(win.location.search);
  const viewport = query.get("viewport") ?? "";
  const scheme = query.get("scheme");
  const named =
    VIEWPORT_VALUES.includes(viewport) ||
    scheme === "light" ||
    scheme === "dark";
  if (VIEWPORT_VALUES.includes(viewport)) setViewport(doc, viewport);
  if (scheme === "light" || scheme === "dark") setColorScheme(doc, scheme);
  if (named || !landing) return;
  const first = data.changedViews[0];
  if (!first) return;
  setViewport(doc, first.viewport);
  setColorScheme(doc, first.colorScheme);
}
