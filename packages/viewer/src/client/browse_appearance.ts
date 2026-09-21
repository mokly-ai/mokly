/**
 * Hands the standalone Appearance control to the Browse client.
 *
 * The classic startup asset applies the appearance before this module exists,
 * so the reader never sees a light first paint. Once Browse is running it owns
 * the richer application — history-replacing frame swaps, comparison panes and
 * component samples — so it takes over through the asset's `onAppearance` hook
 * and re-applies the same scheme through its own path. Each step compares the
 * current source first, so the asset's earlier swap is not repeated.
 */

import { setColorScheme, type BrowseColorScheme } from "./browse_state.js";

/** Dispatched on the document after the Browse client applies an appearance. */
export const APPEARANCE_EVENT = "mokly:appearance";

/** The slot the startup asset calls after every application. */
interface AppearanceHost {
  onAppearance?:
    ((theme: string, scheme: BrowseColorScheme) => void) | undefined;
}

export function installBrowseAppearance(
  doc: Document,
  win: Window & typeof globalThis,
  signal: AbortSignal,
): void {
  const host = win as AppearanceHost;
  const apply = (_theme: string, scheme: BrowseColorScheme): void => {
    setColorScheme(doc, scheme);
    doc.dispatchEvent(new win.Event(APPEARANCE_EVENT));
  };
  host.onAppearance = apply;
  signal.addEventListener(
    "abort",
    () => {
      if (host.onAppearance === apply) host.onAppearance = undefined;
    },
    { once: true },
  );
}
