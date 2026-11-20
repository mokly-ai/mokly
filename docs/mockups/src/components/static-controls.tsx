import { SharedUiThemeProvider, useSharedUiTheme } from "@firna/ui/theme";
import { pillUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import type { ReactNode } from "react";

/** Preserve enabled static controls without serializing interactive behavior. */
export function staticNoop(): void {}

/** A scoped semantic theme keeps the header pill on the shared Button. */
export function PillControls({ children }: { children: ReactNode }) {
  return (
    <SharedUiThemeProvider theme={pillUiTheme(useSharedUiTheme())}>
      {children}
    </SharedUiThemeProvider>
  );
}
