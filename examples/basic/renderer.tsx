// Example renderer adapter proving the consumer contract against the real
// Firna stack: it wraps every screen in the shared @firna/ui theme, renders
// one React tree to static HTML, collects react-native-web's atomic styles,
// and injects them into <head> so @firna/ui controls arrive fully styled.

import { createSharedUiTheme, SharedUiThemeProvider } from "@firna/ui/theme";
import { createContext, type ReactNode, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRegistry } from "react-native-web";

import type { RenderInput } from "@mokly/mokly";

import { LibraryHost } from "./entries/design/library/host.js";
import { DesignRenderedScheme } from "./entries/design/parts/appearance.js";
import { darkTokens, tokens } from "./theme.js";

const themes = {
  dark: createSharedUiTheme(darkTokens),
  light: createSharedUiTheme(tokens),
};

const ViewportContext = createContext("unknown");

function NullComponent(): null {
  return null;
}

function RenderBody({ children }: { children: ReactNode }) {
  const viewport = useContext(ViewportContext);
  return <div data-example-renderer={viewport}>{children}</div>;
}

function collectNativeStyles(): string {
  AppRegistry.registerComponent("__mokly_styles__", () => NullComponent);
  return renderToStaticMarkup(
    AppRegistry.getApplication("__mokly_styles__", {}).getStyleElement(),
  );
}

export default function render(input: RenderInput): string {
  const theme = themes[input.colorScheme];
  const body = renderToStaticMarkup(
    <DesignRenderedScheme scheme={input.colorScheme}>
      <SharedUiThemeProvider theme={theme}>
        <ViewportContext.Provider value={input.viewport}>
          <RenderBody>
            {input.entry.kind === "component" &&
            input.entry.id.startsWith("design-ui-") ? (
              <LibraryHost input={input}>{input.node}</LibraryHost>
            ) : (
              input.node
            )}
          </RenderBody>
        </ViewportContext.Provider>
      </SharedUiThemeProvider>
    </DesignRenderedScheme>,
  );
  const nativeStyles = collectNativeStyles();
  const links = input.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");
  const documentStyles =
    input.colorScheme === "dark"
      ? `html{color-scheme:dark}body{margin:0;background:${theme.colors.bg};color:${theme.colors.ink}}main a{color:${darkTokens.colors.accent}}`
      : `html{color-scheme:light}body{margin:0;background:${theme.colors.bg}}`;
  return `<!doctype html><html lang="en" data-color-scheme="${input.colorScheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${input.entry.title}</title>${links}${nativeStyles}<style>${documentStyles}</style></head><body>${body}</body></html>\n`;
}
