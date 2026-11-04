/** The navigation column's width: its resize callbacks and its bounds. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { useShellRoot } from "./root_context.js";
import { useShellStore, type ShellStore } from "./store_context.js";

/**
 * The resize props of the catalogue column: the store's width and bounds, and
 * the callbacks of the separator. A drag marks the shell root, so the cursor
 * and the frames of the whole root follow it. The root context holds that
 * state. Only an interactive store makes the column resizable.
 */
export function useNavigationResize(store: ShellStore) {
  const root = useShellRoot();
  const ref = useRef<HTMLElement>(null);
  return {
    maximumWidth: store.state.navigationMaximum,
    onResizing: (resizing: boolean) =>
      root?.setResizing(resizing ? "navigation" : undefined),
    onWidth: (width: number) => store.setNavigationWidth(width),
    onWidthCommit: (width: number) => store.persistNavigationWidth(width),
    ref: root?.elements.navigation ?? ref,
    resizable: store.interactive,
    width: store.state.navigationWidth,
  };
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
