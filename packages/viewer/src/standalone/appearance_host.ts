/** The standalone appearance controller the bundle installs before its first render. */

import type { ViewerTheme } from "../host/types.js";

import { installAppearance, type EffectiveAppearance } from "./startup.js";

/** The controller the React bridge reaches through the shell's window. */
export interface StandaloneAppearanceHost {
  /** Apply and persist a reader-selected appearance. */
  choose(theme: ViewerTheme): void;
  /** Adopt a destination pin unless this document has a reader-selected choice. */
  applyRoute(scheme: "dark" | "light" | undefined): void;
  /** Re-apply the current appearance to newly rendered shell elements. */
  refresh(): void;
  /** The appearance and preview scheme in force, which a first render reads. */
  current(): EffectiveAppearance;
}

interface AppearanceHostWindow {
  __moklyAppearance?: StandaloneAppearanceHost | undefined;
}

/** Read the controller that the standalone bundle installed. */
export function standaloneAppearanceHost(
  win: Window | null,
): StandaloneAppearanceHost | undefined {
  return (win as (Window & AppearanceHostWindow) | null)?.__moklyAppearance;
}

/**
 * Opt the stub document in and install the appearance: the document root
 * carries the stored, pinned or system appearance before React renders, and
 * the shell renders its own root from `current()` with the same appearance and
 * the effective preview scheme. Persisted page exits keep the controller for
 * the back-forward cache, and a persisted `pageshow` refreshes the restored
 * page; a final exit disposes it and removes both page listeners.
 */
export function installStandaloneAppearance(
  doc: Document,
  win: Window,
): StandaloneAppearanceHost {
  doc.documentElement.dataset["moklyAppearance"] = "";
  const handle = installAppearance(
    {
      documentElement: doc.documentElement,
      querySelectorAll: (selector) =>
        doc.querySelectorAll(selector) as unknown as Iterable<never>,
    },
    win,
  );
  const owner = win as Window & AppearanceHostWindow;
  const appearance: StandaloneAppearanceHost = {
    choose: (theme) => handle.choose(theme),
    applyRoute: (scheme) => handle.applyRoute(scheme),
    refresh: () => handle.refresh(),
    current: () => handle.current(),
  };
  owner.__moklyAppearance = appearance;
  const dispose = (): void => {
    handle.dispose();
    if (owner.__moklyAppearance === appearance)
      owner.__moklyAppearance = undefined;
    win.removeEventListener("pagehide", pagehide);
    win.removeEventListener("pageshow", pageshow);
  };
  const pagehide = (event: PageTransitionEvent): void => {
    if (!event.persisted) dispose();
  };
  const pageshow = (event: PageTransitionEvent): void => {
    if (event.persisted) handle.refresh();
  };
  win.addEventListener("pagehide", pagehide);
  win.addEventListener("pageshow", pageshow);
  return appearance;
}
