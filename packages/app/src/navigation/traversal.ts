/**
 * The one `popstate` listener that may stop a traversal before the router
 * acts on it.
 *
 * The router installs its own listener when it mounts, so this one is
 * installed as the module loads and runs first. It asks every gate in the
 * order they were added, and a gate that answers `true` stops the router.
 * When no gate stops the traversal, it stops one more kind itself: a step
 * that changes only the query of the router's own entry.
 *
 * Such a step is the application's own. A surface that writes only the query
 * of the path the reader is on reuses the router's entry, so the entry keeps
 * the router's id while its address differs from the one the router recorded.
 * The router then cannot match the address to its record, builds a new
 * navigation state from the address and mounts the screen again, which drops
 * every read the screen held and draws its waiting state for nothing. The
 * query is the application's to read, so the router has nothing to do.
 *
 * The router moves through history itself with `history.go`, and it waits
 * for the `popstate` that answers it. That traversal is the router's own, so
 * the query-only check lets it through. No other code here calls `go`.
 */

/** A gate answers whether the router must not act on this traversal. */
export type TraversalGate = (event: PopStateEvent) => boolean;

/** The router's entry: the id it stores in the history state, and its path. */
interface RoutedEntry {
  id: unknown;
  pathname: string;
}

const gates: TraversalGate[] = [];
let routed: RoutedEntry | undefined;
const listeners = new Set<() => void>();
// Set while a `history.go` the router made has not yet been answered. The
// router records the entry it lands on right after, which clears it.
let routerTraversing = false;

function currentEntry(): RoutedEntry | undefined {
  if (typeof window === "undefined" || !window.location) return undefined;
  const state: unknown = window.history.state;
  const id =
    typeof state === "object" && state !== null && "id" in state
      ? state.id
      : undefined;
  if (id === undefined || id === null) return undefined;
  return { id, pathname: window.location.pathname };
}

/**
 * Record the entry the router is on now. Every `pushState` and
 * `replaceState` calls this, the router's and the application's alike,
 * because the router's entry is the one each of them leaves the reader on.
 */
export function noteRoutedEntry(): void {
  routed = currentEntry();
  routerTraversing = false;
}

/**
 * Add a gate that runs before the router hears a traversal. The settings back
 * guard is one, and it runs before the query-only check, so a draft is always
 * defended first.
 */
export function gateTraversal(gate: TraversalGate): void {
  gates.push(gate);
}

/**
 * Hear each query-only step that this listener keeps from the router. The
 * `popstate` listeners after this one no longer hear it, so they hear it here.
 */
export function onQueryOnlyTraversal(listener: () => void): void {
  listeners.add(listener);
}

function sameRoutedEntry(): boolean {
  const now = currentEntry();
  return (
    routed !== undefined &&
    now !== undefined &&
    now.id === routed.id &&
    now.pathname === routed.pathname
  );
}

function onPopState(event: PopStateEvent): void {
  for (const gate of gates) {
    if (gate(event)) {
      // The router keeps the entry it was on, so the record stays as it is.
      event.stopImmediatePropagation();
      return;
    }
  }
  if (!routerTraversing && sameRoutedEntry()) {
    event.stopImmediatePropagation();
    for (const listener of listeners) listener();
    return;
  }
  noteRoutedEntry();
}

function observeRouterTraversals(history: History): void {
  const go = history.go.bind(history);
  history.go = (delta?: number) => {
    routerTraversing = true;
    go(delta);
  };
}

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("popstate", onPopState);
  // A test stub of `window` may have no history to observe.
  const history: History | undefined = window.history;
  if (history) observeRouterTraversals(history);
}
