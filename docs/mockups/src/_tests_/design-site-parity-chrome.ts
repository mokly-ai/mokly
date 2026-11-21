/**
 * The recorded parity differences of the site chrome area: the header, the
 * menu, the footer, the page base, the shared Canvas parts, the document
 * typography that the legal pages, the docs and the changelog share, and the
 * legal pages. `design-site-parity.test.ts` merges this list with the lists
 * of the other areas. Each key is a selector that the mockup sheets and the
 * site sheets both declare with different values; each value says why, and
 * which milestone of the Canvas redesign plan removes the difference.
 */

const MENU =
  "the mockup draws the open sheet in place, and the site opens it as a modal dialog in the top layer: the sheet also transitions its display and its top-layer overlay so it can fade out, it settles 8px by its top edge rather than a translate, which would make it the containing block of the fixed close control and move that control with the sheet, and it scrolls within the window below the bar";

export const CHROME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-menu": MENU,
  ".site-menu[open]": MENU,
  ".site-policy-body":
    "the mockup's sections pad themselves, so its body has no gap; the site renders a flat Markdown body, so its parts keep the section gap of the policy page and the body's own bottom padding closes the last section",
  ".site-document-body":
    "the mockup wraps each section of a document in a section element and spaces the sections; the site renders a flat Markdown body, so its gap spaces each part",
  ".site-document-body h2":
    "the site renders a flat Markdown body, so each heading carries the rule above its section and the scroll margin that the mockup's section element carries",
};
