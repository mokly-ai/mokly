/** The package-owned shell stylesheet: the shared rules of every root, and the
 * standalone stylesheet Serve and `build` deliver as /mokly-viewer/shell.css. */

import { SHELL_CHROME_CSS } from "./css_chrome.js";
import { SHELL_DETAILS_CSS } from "./css_details.js";
import { SHELL_INSPECTOR_RESIZE_CSS } from "./css_inspector_resize.js";
import { SHELL_NAV_CSS } from "./css_nav.js";
import { CSS_NAV_CHANGED } from "./css_nav_changed.js";
import { SHELL_NAV_RESIZE_CSS } from "./css_nav_resize.js";
import { SHELL_NAV_STATUS_CSS } from "./css_nav_status.js";
import { CSS_NAV_VARIANTS } from "./css_nav_variants.js";
import { SHELL_PREVIEW_SCHEME_CSS } from "./css_preview_scheme.js";
import { SHELL_PREVIEW_CSS } from "./css_previews.js";
import { SHELL_REVIEW_CSS } from "./css_review.js";
import { SHELL_THEME_CSS, STANDALONE_STUB_THEME_CSS } from "./css_theme.js";
import { SHELL_TOKENS_CSS } from "./css_tokens.js";
import { SHELL_VIEW_CSS } from "./css_views.js";
import { SHELL_WORKSPACE_CSS } from "./css_workspace.js";
import { CSS_WORKSPACE_MARKS } from "./css_workspace_marks.js";

/** The shell's own rules, after the tokens, the palette, and the package rules. */
const SHELL_RULES_CSS =
  SHELL_NAV_CSS +
  CSS_NAV_VARIANTS +
  CSS_NAV_CHANGED +
  SHELL_NAV_STATUS_CSS +
  SHELL_NAV_RESIZE_CSS +
  SHELL_VIEW_CSS +
  SHELL_DETAILS_CSS +
  SHELL_CHROME_CSS +
  SHELL_PREVIEW_SCHEME_CSS +
  SHELL_REVIEW_CSS +
  SHELL_WORKSPACE_CSS +
  CSS_WORKSPACE_MARKS +
  SHELL_PREVIEW_CSS +
  SHELL_INSPECTOR_RESIZE_CSS;

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

/** The shell's own shared rules, without the `@mokly/ui` component rules. */
export const SHELL_CSS = shellCss("");
