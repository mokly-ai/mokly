// Example renderer adapter proving the consumer contract against the real
// Firna stack: it wraps every React render in the shared @firna/ui theme for
// the view's colour scheme. The sidecar collects react-native-web's atomic
// styles and the style elements below, and the core assembles the document.

import { createSharedUiTheme, SharedUiThemeProvider } from "@firna/ui/theme";
import type { ReactNode } from "react";

import type { ColorScheme, RenderInput } from "@mokly/mokly";

import { LibraryHost } from "./specs/design/library/host.js";
import { DesignRenderedScheme } from "./specs/design/parts/appearance.js";
import { darkTokens, tokens } from "./theme.js";

const themes = {
  dark: createSharedUiTheme(darkTokens),
  light: createSharedUiTheme(tokens),
};

/** Body text and link colours for plain HTML outside Firna components. */
function documentStyles(colorScheme: ColorScheme): string {
  const theme = themes[colorScheme];
  return colorScheme === "dark"
    ? `body{margin:0;background:${theme.colors.bg};color:${theme.colors.ink}}main a{color:${darkTokens.colors.accent}}`
    : `body{margin:0;background:${theme.colors.bg}}`;
}

export default function render(input: RenderInput): ReactNode {
  return (
    <DesignRenderedScheme scheme={input.colorScheme}>
      <SharedUiThemeProvider theme={themes[input.colorScheme]}>
        <style>{documentStyles(input.colorScheme)}</style>
        <div
          data-color-scheme={input.colorScheme}
          data-example-renderer={input.viewport}
          lang="en"
        >
          {input.entry.kind === "component" &&
          input.entry.path.startsWith("design/library/") ? (
            <LibraryHost input={input}>{input.node}</LibraryHost>
          ) : (
            input.node
          )}
        </div>
      </SharedUiThemeProvider>
    </DesignRenderedScheme>
  );
}
