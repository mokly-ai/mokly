import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { responsiveTokenCss } from "@mokly-cloud/tokens/token-css";
import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { readThemeChoice, writeThemeChoice } from "./choice";
import { ReaderSchemeContext, useSystemScheme } from "./scheme";

const styleId = "mokly-tokens";

/** The document carries the default Canvas family and the reader's scheme. */
function applyDocument(scheme: TokenColorScheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-color-scheme", scheme);
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = responsiveTokenCss(scheme);
}

/**
 * One theme for the whole application: the same token mapping the generated
 * catalogue uses, with the package's live focus ring
 * retained. The token custom properties are emitted once for the document so
 * no stylesheet ever declares a value of its own.
 *
 * The scheme is the Theme the reader chose on this device, else their system
 * preference, which it follows while they have not chosen. The choice is read
 * from the device before the first render and applied before the application
 * first paints. The system preference stays readable apart from it, because
 * the preview documents keep following the system.
 */
export function AppTheme({ children }: { children: ReactNode }) {
  const system = useSystemScheme();
  const [choice, setChoice] = useState(readThemeChoice);
  const scheme = choice ?? system;
  const choose = useCallback((next: TokenColorScheme) => {
    setChoice(next);
    writeThemeChoice(next);
  }, []);
  useLayoutEffect(() => applyDocument(scheme), [scheme]);
  const theme = useMemo(() => paletteUiTheme(scheme), [scheme]);
  const schemes = useMemo(
    () => ({ app: scheme, system, choose }),
    [scheme, system, choose],
  );
  return (
    <ReaderSchemeContext.Provider value={schemes}>
      <SharedUiThemeProvider theme={theme}>{children}</SharedUiThemeProvider>
    </ReaderSchemeContext.Provider>
  );
}
