/** The package-owned shell stylesheet: the shared rules of every root, and the
 * standalone stylesheet Serve and `build` deliver as /mokly-viewer/shell.css. */

import { SHELL_NAV_CSS } from "./css_nav.js";
import { SHELL_NAV_RESIZE_CSS } from "./css_nav_resize.js";
import { SHELL_THEME_CSS, STANDALONE_STUB_THEME_CSS } from "./css_theme.js";
import { SHELL_TOKENS_CSS } from "./css_tokens.js";
import { CSS_VIEWS_LAYOUT } from "./css_views_layout.js";
import { SHELL_WORKSPACE_CSS } from "./css_workspace.js";

/** The shell's own rules, after the tokens, the palette, and the package rules. */
const SHELL_RULES_CSS =
  SHELL_NAV_CSS + SHELL_NAV_RESIZE_CSS + CSS_VIEWS_LAYOUT + SHELL_WORKSPACE_CSS;

/**
 * The rules every shell root shares: the tokens and the palette, then the
 * `@mokly/ui` component rules, which read both, then the shell's own rules.
 * The embedded stylesheet scopes them.
 */
export function shellCss(componentCss: string): string {
  return SHELL_TOKENS_CSS + SHELL_THEME_CSS + componentCss + SHELL_RULES_CSS;
}

/** The standalone stylesheet: the shared rules and the stub's Auto appearance. */
export function standaloneShellCss(componentCss: string): string {
  return shellCss(componentCss) + STANDALONE_STUB_THEME_CSS;
}
