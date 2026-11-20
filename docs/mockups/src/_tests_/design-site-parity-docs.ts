/**
 * The recorded parity differences of the documentation area: the tree, the
 * document column, its rail and its pager. `design-site-parity.test.ts`
 * merges this list with the lists of the other areas. Each key is a selector
 * that the mockup sheets and the site sheets both declare with different
 * values; each value says why.
 */
export const DOCS_DIFFERENCES: Readonly<Record<string, string>> = {
  ".site-doc-disclosure":
    "the site publishes the tree as a disclosure and hides it above the breakpoint; the mockup depicts one composition per screen",
  ".site-doc-tree":
    "the mockup pins the tree from the rule itself; the site pins it from the enclosing column so the disclosure can reuse the tree; the mockup's tree also opens with the search control until Milestone 6 builds the Layers panel with its search",
  ".site-doc-tree-scroll":
    "the scroller only overflows inside the site's pinned column, for the same reason",
  ".site-pager":
    "the mockup stacks the cards by giving them the full measure; the site stacks them with the flex direction",
  ".site-pager-item": "the same stacking difference",
  ".site-pager-item--next": "the same stacking difference",
  ".site-search":
    "the mobile search heads the documentation column above the tree's disclosure, because the Canvas tool bar has no search; Milestone 6 builds the Layers panel with its search",
};
