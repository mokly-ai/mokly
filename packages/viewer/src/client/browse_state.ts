/** Typed Browse state captured across one automatic watched reload. */

import type { LiveChangesStatus } from "../shell/metadata.js";

import {
  isNavDisclosureClosed,
  isNavDisclosureKey,
} from "./browse_navigation.js";
import {
  applyNavVisibility,
  selectAndRevealRoute,
} from "./browse_navigation_state.js";
import { restoreEarlyDisclosures } from "./early_disclosures.js";
import { replaceLocalFrame } from "./same_origin_adapter.js";
import { syncTagChips } from "./tag_filter.js";

/** Color scheme selection applied to fragment frames and device chrome. */
export type BrowseColorScheme = "dark" | "light";

/** Viewport selection applied to screen and use-case stages. */
export type BrowseViewport = "both" | "desktop" | "mobile";

/** User-controlled Browse state that survives one automatic reload. */
export interface BrowseRecoveryState {
  changesStatus?: LiveChangesStatus;
  changedOnly: boolean;
  /** Closed section or projected-collection disclosure identities. */
  closedCollectionIds: readonly string[];
  colorScheme: BrowseColorScheme;
  detailsOpen: boolean;
  drawerOpen: boolean;
  /** Closed disclosure ids from before filtering, or null without a filter. */
  filterBaselineClosedCollectionIds: readonly string[] | null;
  navScroll: number;
  query: string;
  regionScrolls: Readonly<Record<string, number>>;
  viewport: BrowseViewport;
}

/** Read the scroll position of every scrollable stage region. */
export function captureRegionScrolls(doc: Document): Record<string, number> {
  const scrolls: Record<string, number> = {};
  for (const region of doc.querySelectorAll<HTMLElement>(
    "[data-mokly-scroll]",
  )) {
    const key = region.getAttribute("data-mokly-scroll");
    if (key) scrolls[key] = region.scrollTop;
  }
  return scrolls;
}

/** Apply stored scroll positions to the current stage regions. */
export function restoreRegionScrolls(
  doc: Document,
  scrolls: Readonly<Record<string, number>>,
): void {
  for (const region of doc.querySelectorAll<HTMLElement>(
    "[data-mokly-scroll]",
  )) {
    const key = region.getAttribute("data-mokly-scroll");
    if (key && typeof scrolls[key] === "number")
      region.scrollTop = scrolls[key];
  }
}

/** Capture the current shell state when Browse is active. */
export function captureBrowseState(
  doc: Document,
  _win: Window & typeof globalThis,
): BrowseRecoveryState | undefined {
  const shell = doc.querySelector<HTMLElement>("[data-mokly-shell]");
  if (!shell) return undefined;
  const disclosures = [
    ...doc.querySelectorAll<HTMLDetailsElement>("[data-nav-disclosure]"),
  ];
  const closedCollectionIds = disclosures.flatMap((disclosure) => {
    const id = disclosure.getAttribute("data-nav-disclosure");
    return !disclosure.open && id ? [id] : [];
  });
  const filterBaselineClosedCollectionIds = disclosures.some(
    (disclosure) => disclosure.dataset["filterOpen"] !== undefined,
  )
    ? disclosures.flatMap((disclosure) => {
        const id = disclosure.getAttribute("data-nav-disclosure");
        return disclosure.dataset["filterOpen"] === "0" && id ? [id] : [];
      })
    : null;
  const changesStatus = doc.querySelector<HTMLElement>("[data-changes-status]")
    ?.dataset["changesStatus"] as LiveChangesStatus | undefined;
  return {
    ...(changesStatus ? { changesStatus } : {}),
    changedOnly:
      doc
        .querySelector('[data-filter="changed"]')
        ?.getAttribute("aria-pressed") === "true",
    closedCollectionIds,
    colorScheme: currentColorScheme(doc),
    detailsOpen:
      (doc.querySelector<HTMLElement>("[data-workspace-inspector]")
        ? doc.querySelector<HTMLElement>("[data-workspace-inspector]")?.dataset[
            "open"
          ] === "true"
        : undefined) ??
      doc.querySelector<HTMLDetailsElement>("[data-mokly-details]")?.open ??
      false,
    drawerOpen: shell.dataset["drawer"] === "open",
    filterBaselineClosedCollectionIds,
    navScroll:
      doc.querySelector<HTMLElement>("[data-mokly-nav-scroll]")?.scrollTop ?? 0,
    query:
      doc.querySelector<HTMLInputElement>("[data-mokly-search]")?.value ?? "",
    regionScrolls: captureRegionScrolls(doc),
    viewport: currentViewport(doc),
  };
}

/** Restore a validated Browse snapshot into server-rendered shell markup. */
export function restoreBrowseState(
  doc: Document,
  win: Window & typeof globalThis,
  state: BrowseRecoveryState,
): void {
  const shell = doc.querySelector<HTMLElement>("[data-mokly-shell]");
  if (!shell) return;
  const search = doc.querySelector<HTMLInputElement>("[data-mokly-search]");
  if (search) search.value = state.query;
  for (const option of doc.querySelectorAll("[data-filter]")) {
    const changed = option.getAttribute("data-filter") === "changed";
    option.setAttribute(
      "aria-pressed",
      changed === state.changedOnly ? "true" : "false",
    );
  }
  const closed = new Set(state.closedCollectionIds.filter(isNavDisclosureKey));
  const filterBaselineClosed =
    state.filterBaselineClosedCollectionIds === null
      ? undefined
      : new Set(
          state.filterBaselineClosedCollectionIds.filter(isNavDisclosureKey),
        );
  for (const disclosure of doc.querySelectorAll<HTMLDetailsElement>(
    "[data-nav-disclosure]",
  )) {
    const id = disclosure.getAttribute("data-nav-disclosure");
    disclosure.open = !id || !isNavDisclosureClosed(closed, id);
    if (filterBaselineClosed) {
      disclosure.dataset["filterOpen"] =
        id && isNavDisclosureClosed(filterBaselineClosed, id) ? "0" : "1";
    } else {
      delete disclosure.dataset["filterOpen"];
    }
  }
  const details = doc.querySelector<HTMLDetailsElement>("[data-mokly-details]");
  if (details) details.open = state.detailsOpen;
  const inspector = doc.querySelector<HTMLElement>(
    "[data-workspace-inspector]",
  );
  if (inspector) {
    inspector.dataset["open"] = String(state.detailsOpen);
    doc.dispatchEvent(new win.Event("mokly:inspector-restore"));
  }
  setDrawer(shell, state.drawerOpen);
  setViewport(doc, state.viewport);
  setColorScheme(doc, state.colorScheme);
  applyNavVisibility(doc, "preserve");
  const currentStatus = doc.querySelector<HTMLElement>("[data-changes-status]")
    ?.dataset["changesStatus"];
  const deferredChanges =
    state.changedOnly &&
    ((state.changesStatus !== undefined && state.changesStatus !== "ready") ||
      (currentStatus !== undefined && currentStatus !== "ready"));
  if (!deferredChanges)
    selectAndRevealRoute(
      doc,
      win.location.pathname,
      win.location.href,
      "recovery",
    );
  syncTagChips(doc);
  const nav = doc.querySelector<HTMLElement>("[data-mokly-nav-scroll]");
  if (nav) nav.scrollTop = state.navScroll;
  restoreRegionScrolls(doc, state.regionScrolls);
  restoreEarlyDisclosures(doc);
}

/** Apply the responsive navigation drawer state. */
export function setDrawer(shell: HTMLElement, open: boolean): void {
  shell.dataset["drawer"] = open ? "open" : "closed";
  const button = shell.querySelector("[data-mokly-menu]");
  button?.setAttribute("aria-expanded", open ? "true" : "false");
}

/** Apply one viewport selection to every stage and control. */
export function setViewport(doc: Document, value: string): void {
  for (const stage of doc.querySelectorAll("[data-mokly-stage]"))
    stage.setAttribute("data-viewport", value);
  for (const option of doc.querySelectorAll("[data-viewport-option]"))
    option.setAttribute(
      "aria-pressed",
      option.getAttribute("data-viewport-option") === value ? "true" : "false",
    );
}

/** Read the viewport selection the current stage shows. */
export function currentViewport(doc: Document): BrowseViewport {
  const value = doc
    .querySelector("[data-mokly-stage]")
    ?.getAttribute("data-viewport");
  return value === "desktop" || value === "mobile" ? value : "both";
}

/**
 * Apply one color scheme to the body, every scheme control, and every fragment
 * frame. A frame swaps between the server-rendered `data-fragment-light` and
 * `data-fragment-dark` URLs; a screen rendered only for light keeps its light
 * fragment. Each source is compared with the current `src` attribute first,
 * because assigning `src` reloads the frame even when the URL is unchanged.
 *
 * A catalogue built without dark fragments renders no scheme control, so a
 * requested dark scheme is clamped to light there: dark chrome around light
 * fragments would otherwise have no switch to recover from.
 */
export function setColorScheme(doc: Document, value: BrowseColorScheme): void {
  const scheme = doc.querySelector("[data-color-scheme-option]")
    ? value
    : "light";
  doc.body.setAttribute("data-mokly-color-scheme", scheme);
  for (const option of doc.querySelectorAll("[data-color-scheme-option]"))
    option.setAttribute(
      "aria-pressed",
      option.getAttribute("data-color-scheme-option") === scheme
        ? "true"
        : "false",
    );
  for (const frame of doc.querySelectorAll("iframe[data-fragment-light]")) {
    const dark = frame.getAttribute("data-fragment-dark");
    const light = frame.getAttribute("data-fragment-light");
    const next = scheme === "dark" && dark ? dark : light;
    if (
      next &&
      (frame.getAttribute("data-fragment-current") ??
        frame.getAttribute("src")) !== next
    ) {
      const target = frame as HTMLIFrameElement;
      replaceLocalFrame(target, new URL(next, doc.URL));
      frame.setAttribute("data-fragment-current", next);
    }
  }
}

/** Read the color scheme the document currently shows, defaulting to light. */
export function currentColorScheme(doc: Document): BrowseColorScheme {
  return doc.body.getAttribute("data-mokly-color-scheme") === "dark"
    ? "dark"
    : "light";
}
