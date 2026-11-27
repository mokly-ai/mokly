# Member row role drops under the avatar on phones

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from `calummoore/canvas-redesign-m1-cloud-viewer-mockups-1osn`.
- **Location:** `docs/mockups/styles/product/records.css:143`
- **Reason:** The Canvas cloud viewer mockups found it, but their scope did not allow a change to the shared settings stylesheet.

- **Terms:**
  - **Member row:** one row of the Members settings pane, drawn by the `fo-member-row` class: avatar, name, role and a Manage control.
- **Background:** Below the phone breakpoint, `records.css` gives the member
  row two columns and places `.fo-member-row > .fo-role` in the second
  column, under the name. The role now sits inside a `.review-inline`
  wrapper, so the child selector no longer matches it. The stylesheet is
  shared by the mockups and the live app.
- **Problem:** On phones, the role and Manage fall under the avatar column
  instead of the name column, in `product/settings/members` and in the app.
- **Impact if no action:** The Members pane looks misaligned on phones.
- **Root question:** How does the phone layout place the role and Manage
  under the member's name, whatever wraps them?
- **Options:**
  - **A.** Target the wrapper too, for example
    `.fo-member-row > .review-inline`, in the same rule. Effort: Small.
  - **B.** Give the row named grid areas, so that each child declares its
    area and wrappers do not matter. Effort: Small.
- **Left out:** Removing the wrapper, because it carries the inline review
  layout.
- **Wider fix:** B, because a named area does not depend on the DOM depth.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/member-rows-end-in-manage-control.md`: the
  same row. Its open choice may remove Manage from the row, which changes
  this grid too, so do both in one change.
- **Recommendation:** B. It keeps working when the row's markup changes
  again.
- **Action:** fix after merge, apply B, because the redesign branch does not
  own the settings stylesheet.
