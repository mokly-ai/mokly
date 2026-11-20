/**
 * The recorded parity differences of the documentation area: the workspace,
 * the Layers panel with its search and CLI version, the lead, On this page
 * and the pager. `design-site-parity.test.ts` merges this list with the
 * lists of the other areas. Each key is a selector that the mockup sheets
 * and the site sheets both declare with different values; each value says
 * why, and which milestone of the Canvas redesign plan removes the
 * difference.
 */

const WORKSPACE =
  "Canvas docs: the page frame sits on the canvas between the floating Layers and Inspect panels, and below the breakpoint fills the canvas under the sub-bar; Milestone 6 rebuilds the docs layout";
const LAYERS =
  "Canvas docs: the tree is the Layers panel, with the search field and the CLI version row at its top, a page count on each section rubric and the Changelog link in its foot; Milestone 6 rebuilds the docs layout";
const ROWS =
  "Canvas docs: the tree rows are the shared 44px panel rows, which state here only what the tree adds: the canvas tone under the pointer, the signal-soft fill with ink text for the page you are reading, and a quiet Changelog link; Milestone 6 rebuilds the docs layout";
const ON_THIS_PAGE =
  "Canvas docs: On this page is an indexed outline in the Inspect panel, and under the lead in a disclosure below the breakpoint; Milestone 6 rebuilds the docs layout";
const PAGER =
  "Canvas docs: previous and next are two small frames under mono labels, below a rule across the page frame, and take a signal edge on hover; Milestone 6 rebuilds the docs layout";

export const DOCS_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-docs": WORKSPACE,
  ".site-docs-document": WORKSPACE,
  ".site-docs-rail": WORKSPACE,
  ".site-docs-side": WORKSPACE,
  ".site-doc-tree": LAYERS,
  ".site-doc-tree-scroll": LAYERS,
  ".site-doc-tree-foot": LAYERS,
  ".site-doc-tree .site-version": LAYERS,
  ".site-doc-section-head": LAYERS,
  ".site-doc-link": ROWS,
  ".site-doc-link:hover": ROWS,
  '.site-doc-link[aria-current="page"]': ROWS,
  '.site-doc-link[aria-current="page"]:hover': ROWS,
  ".site-doc-tree-foot .site-doc-link": ROWS,
  ".site-search": LAYERS,
  ".site-search:hover": LAYERS,
  ".site-version": LAYERS,
  ".site-version-label": LAYERS,
  ".site-version-link": LAYERS,
  ".site-version-link:hover": LAYERS,
  ".site-onpage-link": ON_THIS_PAGE,
  ".site-onpage-link:hover": ON_THIS_PAGE,
  ".site-pullquote":
    "Canvas docs: the lead is the guide's description beside the signal rule, in secondary ink; Milestone 6 rebuilds the docs layout",
  ".site-pager": PAGER,
  ".site-pager-item": PAGER,
  ".site-pager-item--next": PAGER,
  ".site-pager-item:hover": PAGER,
};
