/** React state bridge to the independently delivered classic appearance asset. */

import { useEffect, useRef, useState } from "react";

import type { ShellStore } from "../shell/store_context.js";
import { normalizeTheme, THEME_ATTRIBUTE } from "../viewer/theme.js";
import type { ViewerTheme } from "../viewer/types.js";

import { standaloneAppearanceHost } from "./appearance_host.js";

/** Appearance values rendered by the standalone document and top bar. */
export interface StandaloneAppearanceState {
  ready: boolean;
  scheme: "dark" | "light";
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
    initialAppearance(store.context.theme, store.state.selection.colorScheme),
  );

  useEffect(() => {
    if (!store.interactive || typeof window === "undefined") return;
    const host = window as Window & AppearanceCallbackWindow;
    const apply = (theme: ViewerTheme, scheme: "dark" | "light") => {
      setAppearance({ ready: true, scheme, theme: normalizeTheme(theme) });
      storeRef.current.selectColorScheme(scheme);
    };
    host.onAppearance = apply;
    const appearanceHost = standaloneAppearanceHost(host);
    if (appearanceHost) appearanceHost.refresh();
    return () => {
      if (host.onAppearance === apply) host.onAppearance = undefined;
    };
  }, [store.interactive]);

  return appearance;
}

function initialAppearance(
  theme: ViewerTheme | undefined,
  fallbackScheme: "dark" | "light",
): StandaloneAppearanceState {
  if (typeof document === "undefined")
    return {
      ready: false,
      scheme: fallbackScheme,
      theme: normalizeTheme(theme),
    };
  const control = document.querySelector<HTMLElement>(
    "[data-mokly-appearance-control]",
  );
  const scheme = document.body.getAttribute("data-mokly-color-scheme");
  return {
    ready: control ? !control.hidden : false,
    scheme: scheme === "dark" || scheme === "light" ? scheme : fallbackScheme,
    theme: normalizeTheme(
      document.documentElement.getAttribute(THEME_ATTRIBUTE),
    ),
  };
}
