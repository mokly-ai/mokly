# Give the route reveal one tree visibility rule

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-17, from the branch
  `calummoore/resetting-search-filter-5hud`, as the wider fix of its review
  items 1 and 2.
- **Location:** `packages/viewer/src/shell/selection.ts:99-172`,
  `packages/viewer/src/shell/nav_model.ts:74-134` and `:143-156`,
  `packages/viewer/src/shell/nav_reveal.ts:32-66`,
  `packages/viewer/src/shell/store_host.ts:137-143` and `:187-198`, and
  `packages/viewer/src/shell/store_filters.ts:26-50`.
- **Reason:** The change reaches folder reveal and every test fixture that
  builds a bare model, so it needs its own branch and its own tests after the
  search reset fix merges.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Route reveal:** `revealSelection` in
    `packages/viewer/src/shell/selection.ts`. It runs on each route change,
    and it clears the search or switches Changes to All only when that filter
    hides the destination row.
  - **Folder reveal:** `folderRevealSelection` in
    `packages/viewer/src/shell/nav_reveal.ts`. A breadcrumb button runs it to
    show a folder row, with the same "clear only what hides the row" rule.
  - **Tree visibility rule:** `navNodeVisible` and `navLeafVisible` in
    `packages/viewer/src/shell/nav_model.ts`. They decide which rows the
    catalogue tree shows under the search and the Changes filter.
  - **Sections:** the tree data that `catalogueNavSections` builds from a
    catalogue.
  - **Listed row:** a variant, or a folder member, that an entry row
    discloses under it.
- **Background:**
  - The viewer selection contract in
    `docs/protocol/mokly-viewer-selection.md`, section "Active Catalogue
    Visibility", says a route change clears a search query only when it
    would hide the destination, and keeps filters and search when the
    destination is already visible.
  - The tree keeps an entry row visible when one of its listed rows matches
    the search, also when the entry itself does not match.
  - The route reveal first compared the query with the entry alone. Commit
    `f08d02dfb` added a `folderTitles` argument so that a query that matches
    a folder title is kept. The search reset fix then added a `sections`
    argument and a second check: the tree visibility rule on the
    destination's row, found with `navEntryRow`.
  - The reveal now keeps the query when either check passes. The old
    entry-alone check is still needed for three cases: a variant (the row
    lookup does not search variant rows), a removed-entry snapshot route, and
    an entry in a hidden folder (the tree hides the row under All).
  - `revealSelection` and `mergeSelection` take the model, the folder
    titles, and the sections as separate arguments. The tests that build a
    bare model pass `[]` or `() => []` for them.
- **Problem:**
  - Two code paths decide one fact: whether the query hides the
    destination. The folder titles argument computes again a value that the
    sections already hold in `leaf.folderTitles`.
  - Folder reveal holds a third version of the same rule.
  - A caller can pass an empty or unrelated tree, and the reveal then falls
    back to the entry-alone check without an error.
- **Impact if no action:** The reveal and the tree can drift apart again. The
  search reset was the second such drift, after the folder title case. A new
  kind of listed row, or a new tree rule, can bring back a search reset with
  no failing test.
- **Root question:** How does every reveal ask the tree, through one rule,
  whether the current filters hide the destination row?
- **Options:**
  - **A.** Change nothing. The two checks agree today, but the class of drift
    stays. Effort: Small.
  - **B.** Make the row lookup find every destination row: current entries,
    variants, and removed snapshot rows. Decide only with the tree rule: the
    query hides the row when the row is visible without the query and hidden
    with it. Delete the entry-alone check and the `folderTitles` argument.
    Keep the current result for an entry in a hidden folder, where the query
    does not hide the row. Add tests for a variant, a snapshot, and a hidden
    row. Effort: Medium.
  - **C.** Do B. Also give `revealSelection` and `mergeSelection` the
    `Catalogue` instead of a model, titles, and sections, and get the tree
    from it, cached per catalogue, for example in a `WeakMap`. Move the
    reveal to one shared function in `nav_reveal.ts` that both the route
    reveal and `folderRevealSelection` call with a tree node. The function
    holds the query rule, the Changes-to-All rule, and the rule for a row
    that the query and Changes hide only together. The tests under `tests/`
    that use bare models build a catalogue with `createCatalogue`.
    Effort: Medium.
- **Left out:** A detection test that compares the reveal with the tree for
  every fixture row. It catches the drift, but C removes it.
- **Wider fix:** C. No type lets a caller give the wrong tree, and one
  function decides "the filter hides this row" for every reveal.
- **Previous examples:** `f08d02dfb` (folder title matches) and the search
  reset fix (listed-row matches) each fixed one drift of this class.
- **Recommendation:** C. It removes the second rule and the empty-tree case,
  so the tree and the reveal cannot drift apart.
- **Action:** fix after merge, apply C, because it changes folder reveal and
  the bare-model fixtures of every caller, and it needs its own tests for
  the variant, snapshot, and hidden-row behaviour.
