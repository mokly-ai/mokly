# Removed page rows have two order rules

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: outside the scope of Milestone 1 of the plan for the viewer's leftover layers.
- **Location:** `docs/protocol/mokly-catalogue-changes.md:107-108`, `docs/protocol/mokly-catalogue-serialization.md:8-12`, and `packages/viewer/src/shell/nav_tree.ts:138-150`.
- **Reason:** The fix changes the words of a protocol requirement, and no recorded decision says which page is right.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Flat removed row:** a navigation row of a removed entry that has no
    current parent or folder to attach to. Changes shows it after the
    current tree.
- **Background:**
  - `mokly-catalogue-changes.md:107-108` appends removed pages and documents
    as flat rows "ordered by path".
  - `mokly-catalogue-serialization.md:8-12` sorts entry arrays by kind, then
    path, and says that navigation uses the same sibling order. The kind
    `document` sorts before `page`.
  - The viewer sorts flat removed rows by kind, then path, in
    `packages/viewer/src/shell/nav_tree.ts:138-150`.
- **Problem:** For removed pages and documents, the two pages give different
  orders. By path, a page and a document interleave. By kind, every removed
  document comes before every removed page.
- **Impact if no action:** A reader of one page expects an order that the
  viewer does not show.
- **Root question:** In which order does Changes show removed pages and
  documents?
- **Options:**
  - **A.** Keep kind, then path, and change `mokly-catalogue-changes.md` to
    say so. No code change. Effort: Small.
  - **B.** Order removed pages and documents by path alone, and change the
    viewer's sort. Effort: Small.
- **Left out:** Changing nothing fails the goal, because the two pages
  disagree. Only these two orders exist in the docs.
- **Wider fix:** None, because the `documentation` skill already covers doc
  drift.
- **Previous examples:** `plans/follow-ups/removed-detail-generation-field.md`.
- **Recommendation:** A. The code and the serialization rule already agree.
- **Action:** ask the user, because the fix changes the words of a protocol
  requirement, and no recorded decision says which page is right.
