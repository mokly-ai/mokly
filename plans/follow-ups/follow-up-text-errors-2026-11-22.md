# Three follow-up items hold small text errors

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 4 of the review of the branch
  `calummoore/mokly-edit-background-render-olos`, list of problems outside
  the scope.
- **Location:** `plans/follow-ups/changes-detail-revision-copies.md` (the term
  **Warm edit**), `plans/follow-ups/serve-edit-background-pass-split.md` (the
  section "Method" of its measurements),
  `plans/follow-ups/closed-experiment-record-kind.md` (its **Background**),
  and `plans/follow-ups/serve-watch-candidate-plan-cost.md` (its
  **Location**).
- **Reason:** The text predates the branch that found it, and that branch
  changed other parts of these items.

- **Source:** Review.
- **Category:** Docs or spec.
- **Background:**
  - `changes-detail-revision-copies.md` defines a warm edit as a source edit
    in a running Serve process after its first classification. The section
    "Method" of `serve-edit-background-pass-split.md` counts only the edits
    after the first edit of a session as warm. So the first edit after a warm
    start is a warm edit in only one of the two items.
  - `closed-experiment-record-kind.md` says that its search listed five
    records under **Location**, and then that the open count included "these
    four".
  - The **Location** of `serve-watch-candidate-plan-cost.md` names
    `crates/mokly-cli/src/serve_rebuild_action.rs:75` as a caller of the
    candidate step. The call is now at line 78.
- **Problem:** Three items hold a definition that disagrees with another item,
  a count that disagrees with itself, and a stale line number.
- **Impact if no action:** A reader compares measurements of edits of
  different kinds, miscounts the records of the kind decision, or looks at the
  wrong line.
- **Root question:** How do these items give one definition, one count, and a
  current line?
- **Options:**
  - **A.** Correct the three texts: one definition of a warm edit in both
    items, the count of `closed-experiment-record-kind.md`, and the line of
    `serve-watch-candidate-plan-cost.md`. Effort: Small.
- **Left out:** Fewer than three approaches are real, because each text is
  either right or wrong. Change nothing: it keeps the three errors.
- **Wider fix:** None. The rule that an item stands alone and stays current is
  in force.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the texts lie outside the
  diff of the branch that found them.
