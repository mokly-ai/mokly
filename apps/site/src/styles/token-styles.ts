/**
 * The complete responsive token themes injected into every static page. Each
 * scheme is emitted beneath its own root selector, so the light, dark and
 * explicit-scheme output coexist in one document without leaking into another
 * scope.
 */

import { responsiveTokenCss } from "@mokly-cloud/tokens/token-css";

const preferredDark = responsiveTokenCss(
  "dark",
  ':root:not([data-color-scheme="light"])',
);

/** Light by default, with explicit and operating-system dark overrides. */
export const SITE_TOKEN_CSS = [
  responsiveTokenCss("light", ":root"),
  responsiveTokenCss("dark", ':root[data-color-scheme="dark"]'),
  `@media (prefers-color-scheme: dark){${preferredDark}}`,
].join("");
