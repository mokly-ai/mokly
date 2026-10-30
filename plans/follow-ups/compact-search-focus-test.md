# Test compact search close and focus recovery

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the F9b re-review of 2026-10-20.
- **Location:** `docs/protocol/mokly-viewer.md:121-127` and
  `tests/browser/viewer_layout.spec.ts:110-122`.
- **Reason:** The review found the gap beside its change, and a missing
  test needs the user's answer under the review-fix rule.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Compact search:** the search control of the embedded viewer when its
    top row is 560px wide or less. Activating it opens a search surface over
    the whole row.
  - **Top-bar slots:** the `topBarStart` and `topBarEnd` host areas in the
    top row of the embedded viewer.
- **Background:**
  - `docs/protocol/mokly-viewer.md:121-127` requires that the open surface
    leaves both host slot subtrees mounted. Close or Escape must restore the
    search control and its focus.
  - `packages/viewer/src/shell/top_bar.tsx:74-76` closes on Escape, and
    line 87 closes on Close. The effect at lines 26-30 then focuses the
    control.
  - `tests/browser/viewer_layout.spec.ts:110-122` runs at 390px and 320px
    with both top-bar slots. It opens the control and checks the input
    focus and its width.
  - `tests/browser/branch_point_ui.ts:163-174` clicks Close search inside a
    longer flow, but it checks no focus.
- **Problem:** No test presses Escape, checks the focus after Close or
  Escape, or checks that the top-bar slot content stays mounted while the
  search is open.
- **Impact if no action:** A change can drop the focus return or unmount a
  host slot, and the suite stays green.
- **Root question:** How does the suite prove the close and focus rules of
  the compact search?
- **Options:**
  - **A.** Extend the 390px and 320px case in `viewer_layout.spec.ts`.
    Keep a handle to each slot node before opening. Then check that both
    nodes are still connected while the search is open. Press Escape and
    check that the control is visible and focused. Repeat with Close.
    Effort: Small.
  - **B.** Change nothing. Effort: Small.
- **Left out:** A unit test without a browser. The rule depends on a
  container query and real focus, which need a browser. So fewer than
  three approaches exist.
- **Wider fix:** None. The class is one missing test for one stated rule,
  and the test itself is the fix.
- **Previous examples:** None found.
- **Related:** [compact-search-activation.md](compact-search-activation.md)
  changes what the same control does after a row activation. The test of
  this item is the natural place to cover that choice too.
- **Recommendation:** A (estimate). It covers a stated requirement with one
  short extension of an existing test.
- **Action:** ask the user, because condition 6 holds: the review-fix rule
  sends every finding about a missing test to the user.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4904).
