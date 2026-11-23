/** The navigation column's width: its resize callbacks and its bounds. */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import { useShellRoot } from "./root_context.js";
import { useShellStore, type ShellStore } from "./store_context.js";

/**
 * The resize props of the catalogue column: the store's width and bounds, and
 * the callbacks of the separator. A drag marks the shell root, so the cursor
 * and the frames of the whole root follow it. The root context holds that
 * state. Only an interactive store makes the column resizable.
 */
export function useNavigationResize(
  store: ShellStore,
  latest: RefObject<ShellStore>,
) {
  const root = useShellRoot();
  const localRef = useRef<HTMLElement>(null);
  const ref = root?.elements.navigation ?? localRef;
  const setResizing = root?.setResizing;
  const onResizing = useCallback(
    (resizing: boolean) => setResizing?.(resizing ? "navigation" : undefined),
    [setResizing],
  );
  const onWidth = useCallback(
    (width: number) => latest.current.setNavigationWidth(width),
    [latest],
  );
  const onWidthCommit = useCallback(
    (width: number) => latest.current.persistNavigationWidth(width),
    [latest],
  );
  const { navigationMaximum: maximumWidth, navigationWidth: width } =
    store.state;
  const resizable = store.interactive;
  return useMemo(
    () => ({
      maximumWidth,
      onResizing,
      onWidth,
      onWidthCommit,
      ref,
      resizable,
      width,
    }),
    [maximumWidth, onResizing, onWidth, onWidthCommit, ref, resizable, width],
  );
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
