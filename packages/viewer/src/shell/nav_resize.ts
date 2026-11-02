/** The navigation column's width: its resize callbacks and its bounds. */

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { useShellRoot } from "./root_context.js";
import { useOptionalShellStore, type ShellStore } from "./store_context.js";

/**
 * The resize props of the catalogue column: the store's width and bounds, and
 * the callbacks of the separator. A drag marks the shell root, so the cursor
 * and the frames of the whole root follow it. The root context holds that
 * state. A render without a store keeps the default width and an inert
 * separator, and only an interactive store makes the column resizable.
 */
export function useNavigationResize(store: ShellStore | undefined) {
  const root = useShellRoot();
  const ref = useRef<HTMLElement>(null);
  return {
    maximumWidth: store?.state.navigationMaximum ?? 480,
    onResizing: store
      ? (resizing: boolean) =>
          root?.setResizing(resizing ? "navigation" : undefined)
      : undefined,
    onWidth: store
      ? (width: number) => store.setNavigationWidth(width)
      : undefined,
    onWidthCommit: store
      ? (width: number) => store.persistNavigationWidth(width)
      : undefined,
    ref: root?.elements.navigation ?? ref,
    resizable: store?.interactive ?? false,
    width: store?.state.navigationWidth ?? 248,
  };
}

/** Keep navigation constraints relative to this shell rather than the window. */
export function useNavigationBounds(root: RefObject<HTMLElement | null>): void {
  const store = useOptionalShellStore();
  const latest = useRef(store);
  latest.current = store;
  useEffect(() => {
    const element = root.current;
    if (!element || !store?.interactive) return;
    const resize = () => {
      const maximum = Math.max(
        192,
        Math.min(480, Math.floor(element.clientWidth / 2)),
      );
      latest.current?.setNavigationMaximum(maximum);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
    };
  }, [root, store?.interactive]);
}
