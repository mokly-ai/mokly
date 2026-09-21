/** Native disclosure choices captured before a shell runtime can adopt them. */

import { HYDRATED_EVENT } from "./hydration_event.js";

const stateKey = "__moklyEarlyDisclosuresV1";
const detailsStateKey = "__moklyEarlyDetailsV1";
const detailsStorageKey = "mokly:details-disclosure";
const storageKey = "mokly:nav-disclosure:v2";

type EarlyDisclosureState = Map<string, boolean>;
type StateWindow = Window &
  typeof globalThis & {
    [detailsStateKey]?: boolean;
    [stateKey]?: EarlyDisclosureState;
  };

/** Attach synchronous capture without changing attributes React owns. */
export function captureEarlyDisclosures(
  doc: Document,
  win: Window & typeof globalThis,
): void {
  if (doc.readyState === "complete") return;
  const owner = win as StateWindow;
  const state = owner[stateKey] ?? new Map<string, boolean>();
  owner[stateKey] = state;
  const hydratedShell = doc.documentElement.hasAttribute(
    "data-mokly-react-shell",
  );
  if (hydratedShell) {
    applyStoredDisclosures(doc, win);
    const detailsOpen = readStoredDetailsPreference(win);
    const details = doc.querySelector<HTMLDetailsElement>(
      "[data-mokly-details]",
    );
    if (details && detailsOpen !== undefined) details.open = detailsOpen;
  }
  const controller = new win.AbortController();
  const signal = controller.signal;
  doc.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : undefined;
      const details = target?.closest("summary")?.parentElement;
      if (
        details instanceof HTMLDetailsElement &&
        details.hasAttribute("data-mokly-details")
      ) {
        owner[detailsStateKey] = !details.open;
        return;
      }
      if (target?.closest("a,button,input,select,textarea,label")) return;
      const group = target?.closest("summary")?.parentElement;
      if (
        !(group instanceof HTMLDetailsElement) ||
        !group.hasAttribute("data-nav-disclosure")
      )
        return;
      const key = group.getAttribute("data-nav-disclosure");
      if (key) state.set(key, !group.open);
    },
    { signal },
  );
  const finish = (event: Event): void => {
    if (event.type === "load" && state.size > 0 && !hydratedShell) {
      restoreEarlyDisclosures(doc);
      if (!doc.querySelector("[data-nav-disclosure][data-filter-open]"))
        rememberDisclosures(doc, win);
    }
    controller.abort();
    delete owner[detailsStateKey];
    delete owner[stateKey];
  };
  win.addEventListener(hydratedShell ? HYDRATED_EVENT : "load", finish, {
    once: true,
    signal,
  });
  win.addEventListener("pagehide", finish, { once: true, signal });
}

/** Read a stable copy for the first hydrated React render. */
export function readEarlyDisclosures(
  doc: Document,
): ReadonlyMap<string, boolean> {
  const win = doc.defaultView as StateWindow | null;
  return new Map(win?.[stateKey] ?? []);
}

/** Read a native Details choice made after stored state was applied. */
export function readEarlyDetailsOpen(doc: Document): boolean | undefined {
  return (doc.defaultView as StateWindow | null)?.[detailsStateKey];
}

/** Expand stored closed keys into the disclosure map used by initial state. */
export function readStoredDisclosures(
  doc: Document,
): Readonly<Record<string, boolean>> {
  const win = doc.defaultView;
  if (!win) return {};
  const closed = storedClosedDisclosures(win);
  if (!closed) return {};
  return Object.fromEntries(
    [...doc.querySelectorAll<HTMLElement>("[data-nav-disclosure]")].flatMap(
      (group) => {
        const key = group.getAttribute("data-nav-disclosure");
        return key && isDisclosureKey(key)
          ? [[key, !isDisclosureClosed(closed, key)]]
          : [];
      },
    ),
  );
}

/** Read the older persisted Details preference without changing the DOM. */
export function readStoredDetailsPreference(
  win: Window | null,
): boolean | undefined {
  try {
    const value = win?.localStorage.getItem(detailsStorageKey);
    if (value === "open") return true;
    if (value === "closed") return false;
  } catch {
    return undefined;
  }
  return undefined;
}

/** Read the actual disclosure DOM handed to React after preference capture. */
export function readHydrationDisclosures(
  doc: Document,
): Readonly<Record<string, boolean>> {
  return Object.fromEntries(
    [...doc.querySelectorAll<HTMLDetailsElement>("[data-nav-disclosure]")]
      .map((group) => [group.getAttribute("data-nav-disclosure"), group.open])
      .filter((entry): entry is [string, boolean] => entry[0] !== null),
  );
}

/** Persist the disclosure DOM that React adopts, including an early choice. */
export function persistHydrationDisclosures(doc: Document): void {
  const win = doc.defaultView;
  if (win) rememberDisclosures(doc, win);
}

/** A native activation is newer than any stored preference or snapshot. */
export function restoreEarlyDisclosures(doc: Document): void {
  const win = doc.defaultView as StateWindow | null;
  const state = win?.[stateKey];
  if (!state) return;
  for (const group of doc.querySelectorAll<HTMLDetailsElement>(
    "details[data-nav-disclosure]",
  )) {
    const key = group.getAttribute("data-nav-disclosure");
    const open = key ? state.get(key) : undefined;
    if (open !== undefined) group.open = open;
  }
}

function rememberDisclosures(
  doc: Document,
  win: Window & typeof globalThis,
): void {
  const closed = [
    ...doc.querySelectorAll<HTMLDetailsElement>("details[data-nav-disclosure]"),
  ].flatMap((group) => {
    const key = group.getAttribute("data-nav-disclosure");
    return !group.open && key && isDisclosureKey(key) ? [key] : [];
  });
  try {
    win.localStorage.setItem(storageKey, JSON.stringify(closed));
  } catch {
    return;
  }
}

function applyStoredDisclosures(
  doc: Document,
  win: Window & typeof globalThis,
): void {
  const closed = storedClosedDisclosures(win);
  if (!closed) return;
  for (const group of doc.querySelectorAll<HTMLDetailsElement>(
    "[data-nav-disclosure]",
  )) {
    const key = group.getAttribute("data-nav-disclosure");
    if (!key || !isDisclosureKey(key)) continue;
    group.open = !isDisclosureClosed(closed, key);
  }
}

function storedClosedDisclosures(
  win: Window & typeof globalThis,
): ReadonlySet<string> | undefined {
  try {
    const raw = win.localStorage.getItem(storageKey);
    if (raw === null) return;
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === "string")
    )
      return;
    return new Set(value.filter(isDisclosureKey));
  } catch {
    return;
  }
}

function isDisclosureClosed(closed: ReadonlySet<string>, key: string): boolean {
  if (closed.has(key)) return true;
  for (const prefix of ["collection:pages:", "collection:components:"]) {
    if (key.startsWith(prefix))
      return closed.has(`collection:${key.slice(prefix.length)}`);
  }
  return false;
}

function isDisclosureKey(value: string): boolean {
  return (
    value.startsWith("collection:") ||
    value === "section:pages" ||
    value === "section:components"
  );
}
