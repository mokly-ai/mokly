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
const LEGAL =
  "each legal document is a page frame on the canvas, ruled by hairlines across its sheet; Milestone 4 rebuilds the legal pages";
const TYPOGRAPHY =
  "Canvas document typography in Geist: Semibold titles, secondary body ink, signal links and chip inline code; Milestone 4 rebuilds the legal pages and Milestone 6 the docs";
const CODE =
  "code panels stay dark in both schemes, with a tab bar and an icon Copy control (design call); Milestone 6 restyles the code panels";
const TRAIL =
  "the trail is the design file's mono uppercase eyebrow; Milestone 6 rebuilds the docs and Milestone 8 the changelog";

export const CHROME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-menu": MENU,
  ".site-menu[open]": MENU,
  ".site-policy": LEGAL,
  ".site-policy-body": LEGAL,
  ".site-policy-links": LEGAL,
  ".site-policy-links-title": LEGAL,
  ".site-policy-link-list": LEGAL,
  ".site-document-body":
    "the mockup wraps each part of a document in a section element; the site renders a flat Markdown body",
  ".site-document-body h2":
    "the site rules its flat body from the heading's own border, which the mockup's sections do not need; Canvas document typography also differs until Milestone 4 rebuilds the legal pages and Milestone 6 the docs",
  ".site-document-body p":
    "the site holds the reading measure on every child of the flat body rather than on paragraphs; Canvas document typography also differs until Milestone 4 rebuilds the legal pages and Milestone 6 the docs",
  ".site-document-intro h1": TYPOGRAPHY,
  ".site-document-body a": TYPOGRAPHY,
  ".site-document-body a:hover": TYPOGRAPHY,
  ".site-document-body code": TYPOGRAPHY,
  ".site-document-body li": TYPOGRAPHY,
  ".site-document-body ol": TYPOGRAPHY,
  ".site-document-body ul": TYPOGRAPHY,
  ".site-trail": TRAIL,
  ".site-code": CODE,
  ".site-code-head": CODE,
  ".site-code-language": CODE,
  ".site-code-copy": CODE,
  ".site-code-copy:hover": CODE,
};
