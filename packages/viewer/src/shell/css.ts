/** The package-owned shell stylesheet: the shared rules of every root, and the
 * standalone stylesheet Serve and `build` deliver as /mokly-viewer/shell.css. */

import { SHELL_THEME_CSS, STANDALONE_STUB_THEME_CSS } from "./css_theme.js";
import { SHELL_TOKENS_CSS } from "./css_tokens.js";

/**
 * The rules every shell root shares: the tokens and the palette, then the
 * `@mokly/ui` rules, which read both and hold the shell's components and
 * layout. The embedded stylesheet scopes them.
 */
export function shellCss(componentCss: string): string {
  return SHELL_TOKENS_CSS + SHELL_THEME_CSS + componentCss;
}

/** The standalone stylesheet: the shared rules and the stub's Auto appearance. */
export function standaloneShellCss(componentCss: string): string {
  return shellCss(componentCss) + STANDALONE_STUB_THEME_CSS;
}
