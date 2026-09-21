/** React state bridge to the independently delivered classic appearance asset. */

import { useEffect, useRef, useState } from "react";

import type { ShellStore } from "../shell/store_context.js";
import { normalizeTheme, THEME_ATTRIBUTE } from "../viewer/theme.js";
import type { ViewerTheme } from "../viewer/types.js";

import { standaloneAppearanceHost } from "./appearance_host.js";

/** Appearance values rendered by the standalone document and top bar. */
export interface StandaloneAppearanceState {
  ready: boolean;
  theme: ViewerTheme;
}

interface AppearanceCallbackWindow {
  onAppearance?:
    ((theme: ViewerTheme, scheme: "dark" | "light") => void) | undefined;
}

/** Keep React selection in step with the classic first-paint controller. */
export function useStandaloneAppearance(
  store: ShellStore,
): StandaloneAppearanceState {
  const storeRef = useRef(store);
  storeRef.current = store;
  const [appearance, setAppearance] = useState(() =>
    initialAppearance(store.context.theme),
  );

  useEffect(() => {
    if (!store.interactive || typeof window === "undefined") return;
    const host = window as Window & AppearanceCallbackWindow;
    const apply = (theme: ViewerTheme, scheme: "dark" | "light") => {
      setAppearance({ ready: true, theme: normalizeTheme(theme) });
      storeRef.current.selectColorScheme(scheme);
    };
    host.onAppearance = apply;
    const appearanceHost = standaloneAppearanceHost(host);
    if (appearanceHost) appearanceHost.refresh();
    else {
      const theme = document.documentElement.getAttribute(THEME_ATTRIBUTE);
      const scheme = document.body.getAttribute("data-mokly-color-scheme");
      apply(normalizeTheme(theme), scheme === "dark" ? "dark" : "light");
    }
    return () => {
      if (host.onAppearance === apply) host.onAppearance = undefined;
    };
  }, [store.interactive]);

  return appearance;
}

function initialAppearance(theme: ViewerTheme | undefined) {
  if (typeof document === "undefined")
    return { ready: false, theme: normalizeTheme(theme) };
  const control = document.querySelector<HTMLElement>(
    "[data-mokly-appearance-control]",
  );
  return {
    ready: control ? !control.hidden : false,
    theme: normalizeTheme(
      document.documentElement.getAttribute(THEME_ATTRIBUTE),
    ),
  };
}
