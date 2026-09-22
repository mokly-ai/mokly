/** Assembled package-owned stylesheet served at /__mokly/shell.css and
 * inlined into static Review artifact pages. */

import { SHELL_CHROME_CSS } from "./css_chrome.js";
import { SHELL_DETAILS_CSS } from "./css_details.js";
import { SHELL_INSPECTOR_RESIZE_CSS } from "./css_inspector_resize.js";
import { SHELL_NAV_CSS } from "./css_nav.js";
import { CSS_NAV_CHANGED } from "./css_nav_changed.js";
import { SHELL_NAV_RESIZE_CSS } from "./css_nav_resize.js";
import { SHELL_NAV_STATUS_CSS } from "./css_nav_status.js";
import { CSS_NAV_VARIANTS } from "./css_nav_variants.js";
import { SHELL_PREVIEW_CSS } from "./css_previews.js";
import { SHELL_REVIEW_CSS } from "./css_review.js";
import { SHELL_TOKENS_CSS } from "./css_tokens.js";
import { SHELL_VIEW_CSS } from "./css_views.js";
import { SHELL_WORKSPACE_CSS } from "./css_workspace.js";
import { CSS_WORKSPACE_MARKS } from "./css_workspace_marks.js";

/** The complete shell stylesheet. */
export const SHELL_CSS =
  SHELL_TOKENS_CSS +
  SHELL_NAV_CSS +
  CSS_NAV_VARIANTS +
  CSS_NAV_CHANGED +
  SHELL_NAV_STATUS_CSS +
  SHELL_NAV_RESIZE_CSS +
  SHELL_VIEW_CSS +
  SHELL_DETAILS_CSS +
  SHELL_CHROME_CSS +
  SHELL_REVIEW_CSS +
  SHELL_WORKSPACE_CSS +
  CSS_WORKSPACE_MARKS +
  SHELL_PREVIEW_CSS +
  SHELL_INSPECTOR_RESIZE_CSS;
