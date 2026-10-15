/** The standalone appearance controller the bundle installs before its first render. */

import type { ViewerTheme } from "../viewer/types.js";

import { installAppearance } from "./startup.js";

/** The controller the React bridge reaches through the shell's window. */
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

/** Read the controller that the standalone bundle installed. */
export function standaloneAppearanceHost(
  win: Window | null,
): StandaloneAppearanceHost | undefined {
  return (win as (Window & AppearanceHostWindow) | null)?.__moklyAppearance;
}

/**
 * Opt the stub document in and install the appearance: the root carries the
 * stored, pinned or system appearance, and the body the effective preview
 * scheme, before React renders a frame. Persisted page exits keep the
 * controller for the back-forward cache; a final exit disposes it.
 */
export function installStandaloneAppearance(
  doc: Document,
  win: Window,
): StandaloneAppearanceHost {
  doc.documentElement.dataset["moklyAppearance"] = "";
  const handle = installAppearance(
    {
      get body() {
        return doc.body;
      },
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
