// Example renderer adapter proving the consumer contract against the real
// Firna stack: it wraps every React render in the shared @firna/ui theme for
// the view's colour scheme. Firna's web controls write inline styles through
// its own DOM backend. The backend's reset and focus rules are one static
// stylesheet, which this renderer returns as a `style` element, so that the
// sidecar collects it and the core places it in the document head before the
// configured stylesheets. The configured stylesheets colour the plain HTML
// around the components in each scheme. It imports hosts and parts only,
// never a whole screen registry: every document links the stylesheet bundled
// from the renderer's imports.

import { domBackendCss } from "@firna/ui";
import { createSharedUiTheme, SharedUiThemeProvider } from "@firna/ui/theme";
import type { ReactNode } from "react";

import type { RenderInput } from "@mokly/mokly";

import { LibraryHost } from "./specs/design/library/host.js";
import { DesignRenderedScheme } from "./specs/design/parts/appearance.js";
import { darkTokens, tokens } from "./theme.js";

const themes = {
  dark: createSharedUiTheme(darkTokens),
  light: createSharedUiTheme(tokens),
};

export default function render(input: RenderInput): ReactNode {
  return (
    <DesignRenderedScheme scheme={input.colorScheme}>
      <style>{domBackendCss}</style>
      <SharedUiThemeProvider theme={themes[input.colorScheme]}>
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
