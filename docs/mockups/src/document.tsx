import { domBackendCss } from "@firna/ui";
import { SharedUiThemeProvider } from "@firna/ui/theme";
import { documentPalettes } from "@mokly-cloud/tokens/palettes";
import { staticUiTheme } from "@mokly-cloud/tokens/shared-ui-theme";
import { tokenCss } from "@mokly-cloud/tokens/token-css";
import type { ReactNode } from "react";

import type { ColorScheme, RenderInput, Viewport } from "@mokly/mokly";

import { documentPalette } from "./document-palette";
import { MockupRenderContext } from "./render-context";

export interface MockupDocumentProps {
  entry: RenderInput["entry"];
  viewport: Viewport;
  colorScheme: ColorScheme;
  children: ReactNode;
}

/**
 * The one wrapper node around a rendered screen or component page. Mokly owns
 * `html`, the head, the title and the stylesheet links, so this wrapper
 * carries what the catalogue adds to a document:
 *
 * - `lang`, the scheme, the viewport and the palette scope class; the mockup
 *   styles read the scheme and the palette from here rather than from `html`;
 * - Firna's DOM backend stylesheet, then the token custom properties, as
 *   `style` elements that Mokly moves into the head, in this order, before
 *   the configured stylesheets;
 * - the static control theme of the scheme and palette, whose boxless
 *   boundary wraps block content only;
 * - on a component page, the paper preview host: one `main` with the entry's
 *   own title as its heading. Mokly calls the renderer around a whole screen
 *   or a component page, never around an instance inside a screen, so no
 *   instance gains a landmark or a heading.
 */
export function MockupDocument({
  entry,
  viewport,
  colorScheme,
  children,
}: MockupDocumentProps) {
  const palette = documentPalette(entry);
  const component = entry.kind === "component";
  const classes = [
    ...(palette === "default" ? [] : [documentPalettes[palette].scope]),
    ...(component ? ["component-document"] : []),
  ];
  return (
    <div
      className={classes.length > 0 ? classes.join(" ") : undefined}
      lang="en"
      data-color-scheme={colorScheme}
      data-viewport={viewport}
    >
      <style>{domBackendCss}</style>
      <style>{tokenCss(colorScheme, viewport)}</style>
      <MockupRenderContext.Provider
        value={{ colorScheme, viewport, path: entry.path }}
      >
        <SharedUiThemeProvider theme={staticUiTheme(colorScheme, palette)}>
          {component ? (
            <main className="component-example">
              <h1>{entry.title}</h1>
              {children}
            </main>
          ) : (
            children
          )}
        </SharedUiThemeProvider>
      </MockupRenderContext.Provider>
    </div>
  );
}
