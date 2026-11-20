import { useEffect, useState } from "react";

/**
 * Who owns the address.
 *
 * The router owns paths. The application owns the query, because two things
 * about the query are the application's own and the router has no equivalent
 * for either:
 *
 * 1. A change that only alters the query of the path the reader is already on
 *    is written here rather than routed, so the depth of the history stack is
 *    the reader's own steps: one entry per overlay, undone rather than written
 *    over, which is what makes one press of Back leave the publication.
 * 2. `pushState` and `replaceState` are wrapped once, at import, because the
 *    router changes the address after its own state and raises nothing when it
 *    does. That wrapping is the only seam that makes "the address the reader is
 *    at" a value a component can hold rather than a guess about effect order.
 *
 * Nothing withholds a key from the router any more: the catalogue screen is
 * `catalogueScreen` on every address the application reads and writes, and
 * React Navigation reserves no such name.
 */
const listeners = new Set<() => void>();
interface ExactReplacement {
  href: string;
}

let exactReplacement: ExactReplacement | undefined;

function announce(): void {
  for (const listener of listeners) listener();
}

function read(): { pathname: string; search: string } {
  if (typeof window === "undefined" || !window.location) {
    return { pathname: "", search: "" };
  }
  return { pathname: window.location.pathname, search: window.location.search };
}

let observing = false;

// How many entries this application has pushed and not yet undone. A surface
// that pushed its own entry can undo it instead of writing another over it,
// which is what keeps the stack exactly as deep as the reader's own steps. A
// traversal the reader made themselves resets the count, because after it
// nothing here can still say which entry is whose.
let pushed = 0;

/**
 * Hear every change to the address, including the router's own. Wrapped once
 * per module evaluation, so a second evaluation cannot announce twice.
 */
function observeHistory(): void {
  if (typeof window === "undefined" || observing) return;
  const history = window.history;
  if (!history?.pushState || !history.replaceState) return;
  observing = true;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (...given: Parameters<History["pushState"]>) => {
    push(...given);
    announce();
  };
  history.replaceState = (...given: Parameters<History["replaceState"]>) => {
    const exact = exactReplacement;
    if (exact !== undefined && sameDestination(given[2], exact.href)) {
      exactReplacement = undefined;
      replace(given[0], given[1], exact.href);
    } else {
      replace(...given);
    }
    announce();
  };
}

observeHistory();

/**
 * The address the reader is at, however it came to be the address: the
 * browser's own back and forward, or any write through the wrapped history
 * operations, which is every write this application and the router make.
 */
export function useAddress(): { pathname: string; search: string } {
  const [address, setAddress] = useState(read);

  useEffect(() => {
    const sync = () => {
      const now = read();
      setAddress((held) =>
        held.pathname === now.pathname && held.search === now.search
          ? held
          : now,
      );
    };
    const traversed = () => {
      pushed = 0;
      sync();
    };
    sync();
    listeners.add(sync);
    window.addEventListener("popstate", traversed);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("popstate", traversed);
    };
  }, []);

  return address;
}

/** The query of the address the reader is at, on the server always empty. */
export function useAddressSearch(): string {
  return useAddress().search;
}

/**
 * The path the reader is at, read from the address rather than from the router.
 * The router derives its path from its own state, and that state has a name for
 * the key this contract reserves, so the path it derives can carry a value the
 * address never had. The address is the page the reader is on.
 */
export function useAddressPathname(): string {
  return useAddress().pathname;
}

/** The same value outside a component, for a handler building the next one. */
export function currentSearch(): string {
  return read().search;
}

/**
 * Write one address on the path the reader is already on. A step the reader can
 * take back is an entry of its own; a correction replaces the entry it corrects,
 * so undoing it cannot land the reader back on the value that was corrected.
 *
 * `history.state` is reused verbatim, so an application-pushed entry carries
 * the router's own `{ key }` and a later traversal resolves against the same
 * navigation state the router built.
 */
export function writeAddress(href: string, replace: boolean): void {
  if (typeof window === "undefined") return;
  const state = window.history.state;
  // Both operations announce themselves, because every address change does.
  if (replace) {
    window.history.replaceState(state, "", href);
    return;
  }
  window.history.pushState(state, "", href);
  pushed += 1;
}

/** The router operation used where a native address has no browser location. */
export interface AddressRouter {
  replace: (href: string) => void;
}

function queryEntries(url: URL): string[] {
  return [...url.searchParams]
    .map(([key, value]) => `${key}\u0000${value}`)
    .sort();
}

function sameDestination(
  candidate: string | URL | null | undefined,
  href: string,
): boolean {
  if (candidate === undefined || candidate === null || !window.location) {
    return false;
  }
  try {
    const current = new URL(candidate.toString(), window.location.href);
    const target = new URL(href, window.location.href);
    return (
      current.origin === target.origin &&
      current.pathname === target.pathname &&
      current.hash === target.hash &&
      JSON.stringify(queryEntries(current)) ===
        JSON.stringify(queryEntries(target))
    );
  } catch {
    return false;
  }
}

function restoreExactAddress(
  replacement: ExactReplacement,
  history: History,
  frames: number,
): void {
  const schedule = window.requestAnimationFrame?.bind(window);
  if (!schedule) return;
  schedule(() => {
    if (exactReplacement !== replacement) return;
    if (sameDestination(window.location.href, replacement.href)) {
      exactReplacement = undefined;
      history.replaceState(history.state, "", replacement.href);
      return;
    }
    if (frames > 1) {
      restoreExactAddress(replacement, history, frames - 1);
      return;
    }
    exactReplacement = undefined;
  });
}

/**
 * Replace a routed address while retaining its exact accepted query bytes.
 * Expo changes the active route on every platform. Browsers then restore the
 * reviewed address text after the router has decoded and serialized it, using
 * the history entry the router just replaced so application state survives.
 */
export function replaceAddress(router: AddressRouter, href: string): void {
  const history = typeof window === "undefined" ? undefined : window.history;
  if (!history?.replaceState) {
    router.replace(href);
    return;
  }
  const replacement = { href };
  exactReplacement = replacement;
  router.replace(href);
  restoreExactAddress(replacement, history, 3);
}

function queryKey(pair: string): string | undefined {
  const separator = pair.indexOf("=");
  const raw = separator === -1 ? pair : pair.slice(0, separator);
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}

function queryPairs(search: string): string[] {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return query.length === 0 ? [] : query.split("&");
}

/** Remove named query pairs without decoding or serializing every other pair. */
export function removeQueryKeys(search: string, removed: ReadonlySet<string>) {
  return queryPairs(search)
    .filter((pair) => {
      const key = queryKey(pair);
      return key === undefined || !removed.has(key);
    })
    .join("&");
}

/** Set one query value in place while retaining every unrelated pair exactly. */
export function setQueryValue(
  search: string,
  key: string,
  value: string,
): string {
  const pair = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  const result: string[] = [];
  let replaced = false;
  for (const current of queryPairs(search)) {
    if (queryKey(current) !== key) {
      result.push(current);
      continue;
    }
    if (!replaced) result.push(pair);
    replaced = true;
  }
  if (!replaced) result.push(pair);
  return result.join("&");
}

/**
 * Undo the entry this application pushed, rather than writing another over it.
 * A surface that pushed one entry and then replaced it leaves the stack a step
 * deeper than the reader's own steps made it, and that step does nothing when
 * they press Back. Answers whether there was one to undo.
 */
export function undoAddress(): boolean {
  if (typeof window === "undefined" || pushed === 0) return false;
  pushed -= 1;
  window.history.back();
  return true;
}

/** One route's query, where a repeated key is the array it was written as. */
export type Query = Record<string, string | string[] | undefined>;

/** The address bar's query keys, keeping a repeated key as the array it is. */
export function readQuery(search: string): Query {
  const parameters = new URLSearchParams(search);
  const query: Query = {};
  for (const key of parameters.keys()) {
    const values = parameters.getAll(key);
    query[key] = values.length > 1 ? values : values[0];
  }
  return query;
}
