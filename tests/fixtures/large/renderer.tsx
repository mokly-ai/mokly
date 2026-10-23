import { createSharedUiTheme, SharedUiThemeProvider } from "@firna/ui/theme";

import type { RenderInput } from "@mokly/mokly";

import { darkTokens, tokens } from "../../../examples/basic/theme.js";

const themes = {
  light: createSharedUiTheme(tokens),
  dark: createSharedUiTheme(darkTokens),
};
export default function render(input: RenderInput) {
  return (
    <SharedUiThemeProvider theme={themes[input.colorScheme]}>
      {input.node}
    </SharedUiThemeProvider>
  );
}
