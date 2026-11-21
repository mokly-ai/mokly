import { useEffect } from "react";

import { isDesktopShell } from "./desktop-shell";

/**
 * Call `listener` each time the desktop shell's window gets focus, and answer
 * how to stop. A reader who leaves the window for setup on the web comes back
 * by focusing it, so this is when the window reads again what the web may have
 * changed. A browser tab is never the shell and subscribes to nothing.
 */
export function onShellFocus(listener: () => void): () => void {
  if (!isDesktopShell()) return () => undefined;
  window.addEventListener("focus", listener);
  return () => window.removeEventListener("focus", listener);
}

/** `onShellFocus` for the lifetime of one mounted component. */
export function useShellFocus(listener: () => void): void {
  useEffect(() => onShellFocus(listener), [listener]);
}
