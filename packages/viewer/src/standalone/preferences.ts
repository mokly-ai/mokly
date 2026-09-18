/** Browser preference handoff performed before standalone hydration. */

import type { ShellInitialState } from "../shell/store_state.js";

import {
  persistHydrationDisclosures,
  readHydrationDisclosures,
} from "./early_disclosures.js";
import { readInitialNavigationWidth } from "./nav_resize.js";

const detailsStorageKey = "mokly:details-disclosure";

/** Read values already reflected into the server DOM for React's first render. */
export function prepareHydrationState(doc: Document): ShellInitialState {
  const win = doc.defaultView;
  const detailsOpen = readDetailsPreference(win);
  if (detailsOpen !== undefined) applyDetailsOpen(doc, detailsOpen);
  const navigation = readInitialNavigationWidth(doc);
  const disclosures = readHydrationDisclosures(doc);
  persistHydrationDisclosures(doc);
  return {
    disclosures,
    ...(detailsOpen === undefined ? {} : { detailsOpen }),
    ...(navigation
      ? {
          navigationMaximum: navigation.maximum,
          navigationWidth: navigation.width,
        }
      : {}),
  };
}

function readDetailsPreference(win: Window | null): boolean | undefined {
  try {
    const value = win?.localStorage.getItem(detailsStorageKey);
    if (value === "open") return true;
    if (value === "closed") return false;
  } catch {
    return undefined;
  }
  return undefined;
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
