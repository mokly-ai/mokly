/** The navigation column's width: its resize callbacks and its bounds. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { useStartingNavigationWidth } from "./canvas_layout.js";
import { useShellRoot } from "./root_context.js";
import { useShellStore, type ShellStore } from "./store_context.js";

/**
 * The resize props of the catalogue column: the width that the reader chose,
 * or else the starting width of the shell's width, the bounds, and the
 * callbacks of the separator. A double click forgets the chosen width. A
 * drag marks the shell root, so the cursor and the frames of the whole root
 * follow it. The root context holds that state. Only an interactive store
 * makes the column resizable.
 */
export function useNavigationResize(store: ShellStore) {
  const root = useShellRoot();
  const ref = useRef<HTMLElement>(null);
  const starting = useStartingNavigationWidth();
  return {
    maximumWidth: store.state.navigationMaximum,
    onResizing: (resizing: boolean) =>
      root?.setResizing(resizing ? "navigation" : undefined),
    onWidth: (width: number) => store.setNavigationWidth(width),
    onWidthCommit: (width: number) => store.persistNavigationWidth(width),
    onWidthReset: () => store.resetNavigationWidth(),
    ref: root?.elements.navigation ?? ref,
    resizable: store.interactive,
    startingWidth: starting,
    width: navigationWidth(store, starting),
  };
}

/** The catalogue's width: the chosen width, or the starting width, bounded. */
function navigationWidth(store: ShellStore, starting: number): number {
  return Math.min(
    store.state.navigationWidth ?? starting,
    store.state.navigationMaximum,
  );
}

/**
 * The catalogue's width that a root states for its floating catalogue and
 * the canvas's start inset; none without a script, where the stylesheet's
 * starting width applies.
 */
export function useNavigationWidth(): number | undefined {
  const store = useShellStore();
  const starting = useStartingNavigationWidth();
  return store.interactive ? navigationWidth(store, starting) : undefined;
}

/** Keep navigation constraints relative to this shell rather than the window. */
export function useNavigationBounds(root: RefObject<HTMLElement | null>): void {
  const store = useShellStore();
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    const element = root.current;
    if (!element || !store.interactive) return;
    const resize = () => {
      const maximum = Math.max(
        192,
        Math.min(480, Math.floor(element.clientWidth / 2)),
      );
      latest.current.setNavigationMaximum(maximum);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
    };
  }, [root, store.interactive]);
}
