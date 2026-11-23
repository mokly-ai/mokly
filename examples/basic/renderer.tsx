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
import type { CSSProperties, ReactNode } from "react";

import type { RenderInput } from "@mokly/mokly";

import { LibraryHost } from "./specs/design/library/host.js";
import { DesignRenderedScheme } from "./specs/design/parts/appearance.js";
import { darkTokens, tokens } from "./theme.js";

const themes = {
  dark: createSharedUiTheme(darkTokens),
  light: createSharedUiTheme(tokens),
};

/**
 * A component's document takes the size of its content, so that the canvas
 * can size the component's frame to the component. The wrapper shrinks to the
 * content's width. As a new block formatting context, it also holds the
 * vertical margins of the component's root, which otherwise collapse through
 * it. A screen keeps the viewport's width, in which its layout centres, and a
 * design library sample fills the window on purpose. No HTML screen of this
 * example uses a React component, so every component render here is a
 * component's own document.
 */
const contentSize: CSSProperties = {
  display: "flow-root",
  width: "fit-content",
};

export default function render(input: RenderInput): ReactNode {
  const component = input.entry.kind === "component";
  const sample = component && input.entry.path.startsWith("design/library/");
  return (
    <DesignRenderedScheme scheme={input.colorScheme}>
      <style>{domBackendCss}</style>
      <SharedUiThemeProvider theme={themes[input.colorScheme]}>
        <div
          data-color-scheme={input.colorScheme}
          data-example-renderer={input.viewport}
          lang="en"
          style={component && !sample ? contentSize : undefined}
        >
          {sample ? (
            <LibraryHost input={input}>{input.node}</LibraryHost>
          ) : (
            input.node
          )}
        </div>
      </SharedUiThemeProvider>
    </DesignRenderedScheme>
  );
}
