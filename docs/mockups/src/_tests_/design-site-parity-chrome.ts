/**
 * The recorded parity differences of the site chrome area: the header, the
 * menu, the footer, the page base, the shared Canvas parts, the document
 * typography that the legal pages, the docs and the changelog share, and the
 * legal pages. `design-site-parity.test.ts` merges this list with the lists
 * of the other areas. Each key is a selector that the mockup sheets and the
 * site sheets both declare with different values; each value says why, and
 * which milestone of the Canvas redesign plan removes the difference.
 */

const TOOL_BAR =
  "Canvas draws the header as the design file's sticky white tool bar with the file title, the people in the file and a green rule under the current page; Milestone 4 rebuilds the site chrome";
const SKIP =
  "the skip link shows on the ink fill above the sticky tool bar; Milestone 4 rebuilds the site chrome";
const BUTTONS =
  "Canvas buttons: the signal fill with its white label of decision 4, a lift on hover and the strong border around the outlined buttons; Milestone 4 rebuilds the site chrome";
const MENU =
  "the menu is the prototype's sheet below the tool bar over a scrim, its close control in the menu control's place; Milestone 4 rebuilds the site chrome";
const FOOTER =
  "the footer is the last frame on the canvas, with the scheme control under the brand and the status bar beneath; Milestone 4 rebuilds the site chrome";
const LEGAL =
  "each legal document is a page frame on the canvas, ruled by hairlines across its sheet; Milestone 4 rebuilds the legal pages";
const TYPOGRAPHY =
  "Canvas document typography in Geist: Semibold titles, secondary body ink, signal links and chip inline code; Milestone 4 rebuilds the legal pages and Milestone 6 the docs";
const CODE =
  "code panels stay dark in both schemes, with a tab bar and an icon Copy control (design call); Milestone 6 restyles the code panels";
const TRAIL =
  "the trail is the design file's mono uppercase eyebrow; Milestone 6 rebuilds the docs and Milestone 8 the changelog";

export const CHROME_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-band": TOOL_BAR,
  ".site-header": TOOL_BAR,
  ".site-nav": TOOL_BAR,
  ".site-nav-link": TOOL_BAR,
  ".site-nav-link:hover": TOOL_BAR,
  ".site-skip": SKIP,
  ".site-skip:focus": SKIP,
  ".site-button": BUTTONS,
  ".site-button--primary": BUTTONS,
  ".site-button--primary:hover": BUTTONS,
  ".site-button--quiet": BUTTONS,
  ".site-button--quiet:hover": BUTTONS,
  ".site-button--secondary": BUTTONS,
  ".site-button--secondary:hover": BUTTONS,
  ".site-menu": MENU,
  ".site-menu[open]": MENU,
  ".site-menu-panel": MENU,
  ".site-menu-head": MENU,
  ".site-menu-nav": MENU,
  ".site-menu-link": MENU,
  ".site-menu-link:hover": MENU,
  '.site-menu-link[aria-current="page"]': MENU,
  ".site-menu-actions": MENU,
  ".site-menu-actions .site-button": MENU,
  ".site-menu-button": MENU,
  ".site-menu-button:hover": MENU,
  ".site-menu-close": MENU,
  ".site-menu-close:hover": MENU,
  ".site-footer": FOOTER,
  ".site-footer-inner": FOOTER,
  ".site-footer-brand": FOOTER,
  ".site-footer-brand p": FOOTER,
  ".site-footer-nav": FOOTER,
  ".site-footer-heading": FOOTER,
  ".site-footer-link": FOOTER,
  ".site-footer-link:hover": FOOTER,
  '.site-footer-link[aria-current="page"]': FOOTER,
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
