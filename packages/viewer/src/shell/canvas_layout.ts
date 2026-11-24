/**
 * The layouts of the shell's canvas: the wide layout at and above its layout
 * breakpoint, where the panels float over the canvas, and the compact layout
 * below it, which shows one frame. The panel step narrows the floating
 * panels below 1180px.
 */

import { useSyncExternalStore } from "react";

import { NARROW_PANELS, NARROW_SHELL } from "./layout_breakpoint.js";

/** The catalogue's starting widths, from the panel step up and below it. */
const STARTING_NAVIGATION_WIDTH = { narrow: 224, wide: 252 } as const;

function media(query: string): MediaQueryList | undefined {
  return typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
    ? undefined
    : window.matchMedia(query);
}

/** Whether a query matches, kept current; a render without a window says no. */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = media(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    () => media(query)?.matches ?? false,
    () => false,
  );
}

/**
 * Whether the shell is at least 900px wide, kept current while it resizes.
 * A render without a window, such as a server render, is wide.
 */
export function useCanvasLayout(): boolean {
  return !useMedia(NARROW_SHELL);
}

/**
 * The catalogue's starting width: 252px, or 224px while the shell is
 * narrower than the 1180px panel step.
 */
export function useStartingNavigationWidth(): number {
  return useMedia(NARROW_PANELS)
    ? STARTING_NAVIGATION_WIDTH.narrow
    : STARTING_NAVIGATION_WIDTH.wide;
}
