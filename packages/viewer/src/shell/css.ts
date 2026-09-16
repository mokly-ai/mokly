/** Assembled package-owned stylesheet served at /__mokly/shell.css and
 * inlined into static Review artifact pages. */

import { SHELL_CHROME_CSS } from "./css_chrome.js";
import { SHELL_DETAILS_CSS } from "./css_details.js";
import { SHELL_NAV_CSS } from "./css_nav.js";
import { SHELL_NAV_RESIZE_CSS } from "./css_nav_resize.js";
import { SHELL_NAV_STATUS_CSS } from "./css_nav_status.js";
import { SHELL_REVIEW_CSS } from "./css_review.js";
import { SHELL_TOKENS_CSS } from "./css_tokens.js";
import { SHELL_VIEW_CSS } from "./css_views.js";
import { SHELL_WORKSPACE_CSS } from "./css_workspace.js";

/** The complete shell stylesheet. */
export const SHELL_CSS =
  SHELL_TOKENS_CSS +
  SHELL_NAV_CSS +
  SHELL_NAV_STATUS_CSS +
  SHELL_NAV_RESIZE_CSS +
  SHELL_VIEW_CSS +
  SHELL_DETAILS_CSS +
  SHELL_CHROME_CSS +
  SHELL_REVIEW_CSS +
  SHELL_WORKSPACE_CSS;
