/** Browser preference handoff performed before standalone hydration. */

import type { ShellInitialState } from "../shell/store_state.js";

import {
  setDisclosureOpen,
  readEarlyDetailsOpen,
  readEarlyDisclosures,
  persistHydrationDisclosures,
  readStoredDetailsPreference,
  readStoredDisclosures,
} from "./early_disclosures.js";
import { readInitialNavigationWidth } from "./nav_resize.js";

const detailsStorageKey = "mokly:details-disclosure";

/** Read values already reflected into the server DOM for React's first render. */
export function prepareHydrationState(
  doc: Document,
  activeDisclosures: readonly string[] = [],
): ShellInitialState {
  const win = doc.defaultView;
  const detailsOpen = readStoredDetailsPreference(win);
  const earlyDetailsOpen = readEarlyDetailsOpen(doc);
  const effectiveDetailsOpen = earlyDetailsOpen ?? detailsOpen;
  if (effectiveDetailsOpen !== undefined) {
    applyDetailsOpen(doc, effectiveDetailsOpen);
    persistDetailsPreference(win, effectiveDetailsOpen);
  }
  const navigation = readInitialNavigationWidth(doc);
  const disclosures = readStoredDisclosures(doc);
  const earlyDisclosures = Object.fromEntries(readEarlyDisclosures(doc));
  const activePath = Object.fromEntries(
    activeDisclosures.map((key) => [key, true]),
  );
  applyDisclosures(doc, {
    ...disclosures,
    ...activePath,
    ...earlyDisclosures,
  });
  persistHydrationDisclosures(doc);
  return {
    disclosures,
    ...(detailsOpen === undefined ? {} : { detailsOpen }),
    ...(earlyDetailsOpen === undefined ? {} : { earlyDetailsOpen }),
    ...(Object.keys(earlyDisclosures).length ? { earlyDisclosures } : {}),
    ...(navigation
      ? {
          navigationMaximum: navigation.maximum,
          navigationWidth: navigation.width,
        }
      : {}),
  };
}

function persistDetailsPreference(win: Window | null, open: boolean): void {
  try {
    win?.localStorage.setItem(detailsStorageKey, open ? "open" : "closed");
  } catch {
    return;
  }
}

function applyDisclosures(
  doc: Document,
  values: Readonly<Record<string, boolean>>,
): void {
  for (const group of doc.querySelectorAll<HTMLElement>(
    "[data-nav-disclosure]",
  )) {
    const key = group.getAttribute("data-nav-disclosure");
    if (key && values[key] !== undefined) setDisclosureOpen(group, values[key]);
  }
}

function applyDetailsOpen(doc: Document, open: boolean): void {
  const details = doc.querySelector<HTMLDetailsElement>("[data-mokly-details]");
  if (details) details.open = open;
  const inspector = doc.querySelector<HTMLElement>(
    "[data-workspace-inspector]",
  );
  if (!inspector) return;
  inspector.dataset["open"] = String(open);
  const content = inspector.querySelector<HTMLElement>(
    ".mbk-inspector-content",
  );
  if (content) content.hidden = !open;
  const close = inspector.querySelector<HTMLElement>("[data-inspector-close]");
  if (close) close.hidden = !open;
  const title = inspector.querySelector<HTMLElement>("[data-inspector-title]");
  if (title) title.textContent = open ? "Details" : "";
  for (const tab of inspector.querySelectorAll<HTMLElement>(
    "[data-inspector-tab]",
  )) {
    tab.setAttribute(
      "aria-selected",
      String(open && tab.dataset["inspectorTab"] === "details"),
    );
  }
  for (const panel of inspector.querySelectorAll<HTMLElement>(
    "[data-inspector-panel]",
  ))
    panel.hidden = !open || panel.dataset["inspectorPanel"] !== "details";
}
