import { createSharedUiTheme, SharedUiThemeProvider } from "@firna/ui/theme";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRegistry } from "react-native-web";

import type { RenderInput } from "@mokly/mokly";

import { InlineViewKey } from "./inline_styles.js";
import { tokens, darkTokens } from "./theme.js";

const themes = {
  light: createSharedUiTheme(tokens),
  dark: createSharedUiTheme(darkTokens),
};
const Empty = () => null;
const AREA_ONE_ACTION_COLOR = "rgba(1,2,3,1.00)";
const SCREEN_ONE_MARKUP = "";

export default function render(input: RenderInput): string {
  const body = renderToStaticMarkup(
    <SharedUiThemeProvider theme={themes[input.colorScheme]}>
      <InlineViewKey.Provider
        value={JSON.stringify([
          input.entry.path,
          input.viewport,
          input.colorScheme,
        ])}
      >
        {input.node}
      </InlineViewKey.Provider>
    </SharedUiThemeProvider>,
  );
  AppRegistry.registerComponent("scale-styles", () => Empty);
  const nativeStyles = renderToStaticMarkup(
    AppRegistry.getApplication("scale-styles", {}).getStyleElement(),
  ).replace("rgba(1,2,3,1.00)", AREA_ONE_ACTION_COLOR);
  const markedBody =
    input.entry.path === "area-1/screens/activity-group-1/screen-1" &&
    SCREEN_ONE_MARKUP
      ? body.replace(
          "<main ",
          `<main data-scale-markup="${SCREEN_ONE_MARKUP}" `,
        )
      : body;
  const links = input.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");
  return `<!doctype html><html lang="en" data-color-scheme="${input.colorScheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${input.entry.title}</title>${links}${nativeStyles}</head><body>${markedBody}</body></html>`;
}
