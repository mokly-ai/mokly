/**
 * Restores the standalone catalogue's Appearance on the document root and keeps
 * every frame showing the matching fragment. It is deliberately outside the
 * React entry's execution path: a classic asset can run before the shell
 * stylesheet paints, so a dark reader never sees a light first frame.
 *
 * The package-owned `appearance-startup.js` classic entry calls this. The asset
 * is delivered ahead of the standalone control, so production markup does not
 * reference it until that control opts the document in.
 */

import { THEME_ATTRIBUTE } from "../viewer/theme.js";
import type { ViewerTheme } from "../viewer/types.js";

import {
  effectiveScheme,
  readStoredAppearance,
  resolveAppearance,
  schemePin,
  storeAppearance,
  type AppearanceStorage,
} from "./preference.js";

/** A frame whose light and dark sources the shell records on the element. */
interface AppearanceFrame {
  src: string;
  dataset: {
    fragmentLight?: string | undefined;
    fragmentDark?: string | undefined;
  };
}

/** The document surface this module touches, so a test can supply its own. */
export interface AppearanceDocument {
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    dataset: { moklyAppearance?: string | undefined };
  };
  querySelectorAll(selector: string): Iterable<AppearanceFrame>;
}

/** The window surface this module touches. */
export interface AppearanceWindow {
  location: { search: string };
  matchMedia(query: string): {
    matches: boolean;
    addEventListener(type: "change", handler: () => void): void;
    removeEventListener(type: "change", handler: () => void): void;
  };
  localStorage?: AppearanceStorage | undefined;
}

/** A live installation: choose an appearance, or remove what it installed. */
export interface AppearanceHandle {
  choose(theme: ViewerTheme): void;
  dispose(): void;
}

const FRAME_SELECTOR = "[data-fragment-light][data-fragment-dark]";
const INSTALLED = new WeakSet<object>();
const INERT: AppearanceHandle = { choose: () => {}, dispose: () => {} };

function storageOf(window: AppearanceWindow): AppearanceStorage {
  try {
    return window.localStorage ?? NO_STORAGE;
  } catch {
    // Reaching for localStorage itself throws on a blocked origin.
    return NO_STORAGE;
  }
}

const NO_STORAGE: AppearanceStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/**
 * Points every dual-scheme frame at the source matching the effective scheme.
 * Assigning the same source would reload the frame, so each one is only written
 * when it actually changes, which also makes a repeated install a no-op.
 */
function applyFrames(
  document: AppearanceDocument,
  scheme: "dark" | "light",
): void {
  for (const frame of document.querySelectorAll(FRAME_SELECTOR)) {
    const next =
      scheme === "dark"
        ? frame.dataset.fragmentDark
        : frame.dataset.fragmentLight;
    if (next && frame.src !== next) frame.src = next;
  }
}

/**
 * Installs the appearance on an opted-in standalone document. A document that
 * has not opted in keeps whatever it rendered, so an embedded host page is
 * never touched by an asset it did not ask for.
 */
export function installAppearance(
  document: AppearanceDocument,
  window: AppearanceWindow,
): AppearanceHandle {
  const root = document.documentElement;
  if (root.dataset.moklyAppearance === undefined) return INERT;
  const storage = storageOf(window);
  const initial = root.getAttribute(THEME_ATTRIBUTE);
  let theme = resolveAppearance({
    pin: schemePin(window.location.search),
    stored: readStoredAppearance(storage),
    ...(initial ? { initial: initial as ViewerTheme } : {}),
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = (): void => {
    root.setAttribute(THEME_ATTRIBUTE, theme);
    applyFrames(document, effectiveScheme(theme, media.matches));
  };
  apply();
  // A second install must not add a second system listener, and the first
  // handle keeps working, so both can be disposed in any order.
  if (INSTALLED.has(root)) return { choose: choose, dispose: () => {} };
  INSTALLED.add(root);
  const followSystem = (): void => {
    if (theme === "auto") apply();
  };
  media.addEventListener("change", followSystem);
  function choose(next: ViewerTheme): void {
    theme = next;
    storeAppearance(storage, next);
    apply();
  }
  return {
    choose,
    dispose: () => {
      media.removeEventListener("change", followSystem);
      INSTALLED.delete(root);
    },
  };
}
