/** One React appearance owner for the lifetime of the standalone shell. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { ViewerTheme } from "../host/types.js";
import type { AppearanceState } from "../shell/appearance.js";
import { THEME_ATTRIBUTE } from "../shell/theme.js";

import { effectiveScheme, storeAppearance } from "./preference.js";
import { appearanceStorage, type EffectiveAppearance } from "./startup.js";

export interface StandaloneAppearance extends AppearanceState {
  scheme: "dark" | "light";
  applyRoute(scheme: "dark" | "light" | undefined): void;
}

/** Keep preference, system changes, route pins, and restoration in one owner. */
export function useStandaloneAppearance(
  win: Window,
  initial: EffectiveAppearance,
): StandaloneAppearance {
  const [theme, setTheme] = useState(initial.theme);
  const [systemDark, setSystemDark] = useState(initial.scheme === "dark");
  const chosen = useRef(false);
  const scheme = effectiveScheme(theme, systemDark);
  const onChange = useCallback(
    (next: ViewerTheme) => {
      chosen.current = true;
      storeAppearance(appearanceStorage(win), next);
      setTheme(next);
    },
    [win],
  );
  const applyRoute = useCallback((pin: "dark" | "light" | undefined) => {
    if (pin && !chosen.current) setTheme(pin);
  }, []);

  useLayoutEffect(() => {
    win.document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  });

  useEffect(() => {
    const media = win.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => setSystemDark(media.matches);
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      refresh();
      win.document.documentElement.setAttribute(
        THEME_ATTRIBUTE,
        themeRef.current,
      );
    };
    refresh();
    media.addEventListener("change", refresh);
    win.addEventListener("pageshow", restored);
    return () => {
      media.removeEventListener("change", refresh);
      win.removeEventListener("pageshow", restored);
    };
  }, [win]);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  return { ready: true, theme, scheme, onChange, applyRoute };
}
