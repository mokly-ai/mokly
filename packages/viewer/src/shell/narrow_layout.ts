/** The narrow layout of the shell, below which use-case steps show phones. */

import { useSyncExternalStore } from "react";

import { NARROW_LAYOUT } from "./layout_breakpoint.js";

function media(): MediaQueryList | undefined {
  return typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
    ? undefined
    : window.matchMedia(NARROW_LAYOUT);
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  list?.addEventListener("change", onChange);
  return () => list?.removeEventListener("change", onChange);
}

/**
 * Whether the shell's window is at most 760px wide, kept current while it
 * resizes. A render without a window, such as a server render, is wide.
 */
export function useNarrowLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  );
}
