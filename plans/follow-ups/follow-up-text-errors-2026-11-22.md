# Follow-up items hold small text errors

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from rounds 4 and 5 of the review of the branch
  `calummoore/mokly-edit-background-render-olos`, lists of problems outside
  the scope.
- **Location:** `plans/follow-ups/changes-detail-revision-copies.md` (the term
  **Warm edit**), `plans/follow-ups/serve-edit-background-pass-split.md` (the
  section "Method" of its measurements),
  `plans/follow-ups/closed-experiment-record-kind.md` (its **Background**),
  `plans/follow-ups/serve-watch-candidate-plan-cost.md` (its **Location**),
  `plans/follow-ups/record-release-expect.md` (its option B),
  `plans/follow-ups/prepare-only-describe.md:57`, and
  `plans/follow-ups/light-sidecar-entry.md:99`.
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
  - Option B of `record-release-expect.md` keeps the bundle settings, the
    compiled recipe, and the module inventory in one struct. But the leases
    of a generation stay in another map, and
    `crates/mokly-sidecar/src/pool_requests.rs:79` inserts them with the three
    values, so option B still leaves one `expect` or one check.
  - `prepare-only-describe.md:57` and `light-sidecar-entry.md:99` name
    "workspace 234" and "workspace 233" in their bodies, numbers that only the
    workspace system explains.
- **Problem:** Follow-up items hold a definition that disagrees with another
  item, a count that disagrees with itself, a stale line number, an option
  that does not remove its own case, and workspace numbers that the
  repository does not explain.
- **Impact if no action:** A reader compares measurements of edits of
  different kinds, miscounts the records of the kind decision, looks at the
  wrong line, builds an option that does not remove its case, or cannot find
  the source of a fact.
- **Root question:** How do these items give one definition, one count, a
  current line, an option that removes its case, and facts that the
  repository explains?
- **Options:**
  - **A.** Correct the texts: one definition of a warm edit in both items, the
    count of `closed-experiment-record-kind.md`, the line of
    `serve-watch-candidate-plan-cost.md`, the leases in option B of
    `record-release-expect.md`, and the workspace numbers, replaced by the
    branch names and the facts that they stand for. Effort: Small.
- **Left out:** Fewer than three approaches are real, because each text is
  either right or wrong. Change nothing: it keeps the three errors.
- **Wider fix:** None. The rule that an item stands alone and stays current is
  in force.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the texts lie outside the
  diff of the branch that found them.
