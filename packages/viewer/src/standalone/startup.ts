/** Resolve the stub's appearance before React renders any shell or frame. */

import type { ViewerTheme } from "../host/types.js";
import { normalizeTheme, THEME_ATTRIBUTE } from "../shell/theme.js";

import {
  effectiveScheme,
  readStoredAppearance,
  resolveAppearance,
  schemePin,
  type AppearanceStorage,
} from "./preference.js";

/** The reader's appearance and its effective preview scheme. */
export interface EffectiveAppearance {
  theme: ViewerTheme;
  scheme: "dark" | "light";
}

const NO_STORAGE: AppearanceStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** A blocked origin store acts like an absent preference. */
export function appearanceStorage(win: Window): AppearanceStorage {
  try {
    return win.localStorage ?? NO_STORAGE;
  } catch {
    return NO_STORAGE;
  }
}

/** Read once before createRoot, without installing listeners or a controller. */
export function initialStandaloneAppearance(
  doc: Document,
  win: Window,
): EffectiveAppearance {
  const initial = doc.documentElement.getAttribute(THEME_ATTRIBUTE);
  const theme = resolveAppearance({
    pin: schemePin(win.location.search),
    stored: readStoredAppearance(appearanceStorage(win)),
    ...(initial ? { initial: normalizeTheme(initial) } : {}),
  });
  doc.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  return {
    theme,
    scheme: effectiveScheme(
      theme,
      win.matchMedia("(prefers-color-scheme: dark)").matches,
    ),
  };
}
