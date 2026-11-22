/**
 * The wide layout of the shell, at and above its layout breakpoint, where
 * the canvas holds the selected entry. Below the breakpoint, the one-frame
 * stage stays until the compact layout replaces it.
 */

import { useSyncExternalStore } from "react";

import { NARROW_SHELL } from "./layout_breakpoint.js";

function media(): MediaQueryList | undefined {
  return typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
    ? undefined
    : window.matchMedia(NARROW_SHELL);
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  list?.addEventListener("change", onChange);
  return () => list?.removeEventListener("change", onChange);
}

/**
 * Whether the shell is at least 900px wide, kept current while it resizes.
 * A render without a window, such as a server render, is wide.
 */
export function useCanvasLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !(media()?.matches ?? false),
    () => true,
  );
}
