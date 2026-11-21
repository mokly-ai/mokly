import { SharedUiThemeProvider } from "@firna/ui/theme";
import { paletteUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { responsiveTokenCss } from "@mokly-cloud/tokens/token-css";
import type { TokenColorScheme } from "@mokly-cloud/tokens/tokens";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";

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
 */
export function AppTheme({ children }: { children: ReactNode }) {
  const scheme = useSystemScheme();
  useEffect(() => applyDocument(scheme), [scheme]);
  const theme = useMemo(() => paletteUiTheme(scheme), [scheme]);
  return (
    <ReaderSchemeContext.Provider value={scheme}>
      <SharedUiThemeProvider theme={theme}>{children}</SharedUiThemeProvider>
    </ReaderSchemeContext.Provider>
  );
}
