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

import { normalizeTheme, THEME_ATTRIBUTE } from "../viewer/theme.js";
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
  getAttribute(name: "src"): string | null;
  dataset: {
    fragmentLight?: string | undefined;
    fragmentDark?: string | undefined;
  };
}

/** The control that sets the appearance, once the document has rendered it. */
interface AppearanceControl {
  value: string;
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "change", handler: () => void): void;
}

/** The document surface this module touches, so a test can supply its own. */
export interface AppearanceDocument {
  /** Absent while the asset runs ahead of the stylesheet, in the head. */
  body?: { setAttribute(name: string, value: string): void } | null | undefined;
  documentElement: {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    dataset: { moklyAppearance?: string | undefined };
  };
  querySelectorAll(
    selector: string,
  ): Iterable<AppearanceFrame & AppearanceControl>;
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
  /** Notified after each application, so a host can mirror the scheme. */
  onAppearance?:
    ((theme: ViewerTheme, scheme: "dark" | "light") => void) | undefined;
}

/** A live installation: choose an appearance, or remove what it installed. */
export interface AppearanceHandle {
  choose(theme: ViewerTheme): void;
  /**
   * Re-applies once the document has a body, frames and controls. The asset
   * runs in the head so the root is right before the first paint, and calls
   * this when the DOM is ready to finish the job.
   */
  refresh(): void;
  dispose(): void;
}

const FRAME_SELECTOR = "[data-fragment-light][data-fragment-dark]";
const NO_STORAGE: AppearanceStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const SELECT_SELECTOR = "[data-mokly-appearance-select]";
// The select carries the value; its label carries the reveal, because the
// stylesheet hides the whole control until its behaviour exists.
const CONTROL_SELECTOR = "[data-mokly-appearance-control]";
const VALUE_ATTRIBUTE = "data-appearance-value";
const INERT: AppearanceHandle = {
  choose: () => {},
  refresh: () => {},
  dispose: () => {},
};

/**
 * One controller per document root. A document has one appearance, so every
 * handle over the same root shares the theme, the system listener and the
 * store: a choice made through one handle is the choice the listener sees.
 */
interface Controller {
  theme: ViewerTheme;
  handles: number;
  apply(): void;
  bind(): void;
  choose(theme: ViewerTheme): void;
  release(): void;
}
const CONTROLLERS = new WeakMap<object, Controller>();

function storageOf(window: AppearanceWindow): AppearanceStorage {
  try {
    return window.localStorage ?? NO_STORAGE;
  } catch {
    // Reaching for localStorage itself throws on a blocked origin.
    return NO_STORAGE;
  }
}

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
    if (next && frame.getAttribute("src") !== next) frame.src = next;
  }
}

function createController(
  document: AppearanceDocument,
  window: AppearanceWindow,
): Controller {
  const root = document.documentElement;
  const storage = storageOf(window);
  const initial = root.getAttribute(THEME_ATTRIBUTE);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const bound = new WeakSet<object>();
  const controller: Controller = {
    theme: resolveAppearance({
      pin: schemePin(window.location.search),
      stored: readStoredAppearance(storage),
      ...(initial ? { initial: initial as ViewerTheme } : {}),
    }),
    handles: 0,
    apply() {
      root.setAttribute(THEME_ATTRIBUTE, controller.theme);
      const scheme = effectiveScheme(controller.theme, media.matches);
      // The preview scheme is the same choice, so the document mark the shell
      // already keys its frames and captions off follows the appearance.
      document.body?.setAttribute("data-mokly-color-scheme", scheme);
      applyFrames(document, scheme);
      for (const select of document.querySelectorAll(SELECT_SELECTOR))
        select.value = controller.theme;
      for (const control of document.querySelectorAll(CONTROL_SELECTOR)) {
        // The visible glyph and word are chosen from this one value, so the
        // control names the appearance it actually set.
        control.setAttribute(VALUE_ATTRIBUTE, controller.theme);
        control.hidden = false;
      }
      window.onAppearance?.(controller.theme, scheme);
    },
    bind() {
      for (const select of document.querySelectorAll(SELECT_SELECTOR)) {
        if (bound.has(select)) continue;
        bound.add(select);
        select.addEventListener("change", () =>
          controller.choose(normalizeTheme(select.value)),
        );
      }
    },
    choose(theme) {
      controller.theme = theme;
      storeAppearance(storage, theme);
      controller.apply();
    },
    release() {
      controller.handles -= 1;
      if (controller.handles > 0) return;
      media.removeEventListener("change", followSystem);
      CONTROLLERS.delete(root);
    },
  };
  const followSystem = (): void => {
    if (controller.theme === "auto") controller.apply();
  };
  media.addEventListener("change", followSystem);
  return controller;
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
  const controller =
    CONTROLLERS.get(root) ?? createController(document, window);
  CONTROLLERS.set(root, controller);
  controller.handles += 1;
  controller.apply();
  let live = true;
  return {
    choose(theme) {
      // A disposed handle no longer speaks for a document it does not own.
      if (live) controller.choose(theme);
    },
    refresh() {
      if (!live) return;
      controller.bind();
      controller.apply();
    },
    dispose() {
      if (!live) return;
      live = false;
      controller.release();
    },
  };
}
