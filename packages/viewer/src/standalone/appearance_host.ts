/** Browser handoff to the classic standalone appearance controller. */

import type { ViewerTheme } from "../viewer/types.js";

/** Global controller installed synchronously by `appearance-startup.js`. */
export interface StandaloneAppearanceHost {
  /** Apply and persist a reader-selected appearance. */
  choose(theme: ViewerTheme): void;
  /** Adopt a destination pin unless this document has a reader-selected choice. */
  applyRoute(scheme: "dark" | "light" | undefined): void;
  /** Re-apply the current appearance to newly rendered shell elements. */
  refresh(): void;
}

interface AppearanceHostWindow {
  __moklyAppearance?: StandaloneAppearanceHost | undefined;
}

/** Read the controller without making the hydrated shell own its behavior. */
export function standaloneAppearanceHost(
  win: Window | null,
): StandaloneAppearanceHost | undefined {
  return (win as (Window & AppearanceHostWindow) | null)?.__moklyAppearance;
}

/** Align parsed server markup before React reads its hydration state. */
export function refreshStandaloneAppearance(doc: Document): void {
  standaloneAppearanceHost(doc.defaultView)?.refresh();
}
