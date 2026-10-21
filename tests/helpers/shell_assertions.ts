/**
 * Collapse stylesheet whitespace so contract assertions pin selectors and
 * declarations rather than the source module's line wrapping.
 */
export function flatCss(css: string): string {
  return css.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")");
}
