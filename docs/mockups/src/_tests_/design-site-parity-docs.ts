/**
 * The recorded parity differences of the documentation area: the workspace,
 * the page frame's document and the tree sheet. `design-site-parity.test.ts`
 * merges this list with the lists of the other areas. Each key is a selector
 * that the mockup sheets and the site sheets both declare with different
 * values; each value says why the difference is structural.
 */

const COLUMNS =
  "the mobile mockup does not draw the Layers and Inspect columns, so the rule that places them applies to its mobile composition unseen; the site draws both columns on every page and hides them below the breakpoint";

export const DOCS_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-docs-rail": COLUMNS,
  ".site-docs-side": COLUMNS,
  ".site-docs-frame .site-document-body":
    "the mockup wraps each h2 section in a section element that pads itself and spaces its parts; the site renders a flat Markdown body, so its parts keep the section's 18px gap, and it counts its h2 headings for their two-digit indexes",
  ".site-docs-sheet":
    "the mockup draws the open tree sheet only in its mobile composition, under the 60px tool bar; from 768px to 1023px the site's sheet drops in under the 56px tool bar and the 52px sub-bar, 108px from the top",
};
