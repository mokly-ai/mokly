# Test compact search host slots and restored control

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the F9b re-review of 2026-10-20.
- **Location:** `docs/protocol/mokly-viewer.md:124-130` and
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
  - `docs/protocol/mokly-viewer.md:124-130` requires that the open surface
    leaves both host slot subtrees mounted. Close or Escape must restore the
    search control and its focus.
  - Since PR #249 of 2026-10-30, the package component in
    `packages/ui/src/top-bar/top-bar.tsx` closes on Escape at line 107 and
    on Close at line 120. The effect at lines 66-71 then focuses the
    control. Before, `packages/viewer/src/shell/top_bar.tsx:74-76`, `:87`,
    and `:26-30` held this code.
  - `packages/ui/tests/top-bar.test.tsx:123-148`, which PR #249 added, opens
    the compact search, presses Escape, and checks the focus return to the
    control after Escape and after Close. It runs in the happy-dom window of
    `packages/ui/tests/dom.ts`, without CSS or container layout. So it
    proves the state and the focus, but not that the control is visible.
  - The host slots render beside the package component, in the viewer's
    embedded root at `packages/viewer/src/shell/embedded_viewer.tsx:65-68`.
    So the package test does not render them.
  - `tests/browser/viewer_layout.spec.ts:110-122` runs at 390px and 320px
    with both top-bar slots. It opens the control and checks the input
    focus and its width. It checks that the control is visible only before
    it opens the search.
  - `tests/browser/branch_point_ui.ts:163-174` clicks Close search inside a
    longer flow, but it checks no focus.
- **Problem:**
  - No test checks that the top-bar slot content stays mounted while the
    search is open.
  - No browser test checks that Escape or Close shows the search control
    again. The package test cannot check it, because it has no CSS or
    container layout.
  - Until PR #249 on 2026-10-30, no test pressed Escape or checked the focus
    after Close or Escape. The package test now covers that state and that
    focus return.
- **Impact if no action:** A change can unmount a host slot, or leave the
  restored control hidden at a narrow width, and the suite stays green.
- **Root question:** How does the suite prove that the open compact search
  keeps the host slots mounted, and that Close or Escape shows the control
  again?
- **Options:**
  - **A.** Extend the 390px and 320px case in `viewer_layout.spec.ts`.
    Keep a handle to each slot node before opening. Then check that both
    nodes are still connected while the search is open. Press Escape and
    check that the control is visible. Repeat with Close. Effort: Small.
    Until PR #249, A also checked that the control is focused after Escape
    and Close. The package test now covers that focus check, so A leaves it
    out.
  - **B.** Change nothing. Effort: Small.
- **Left out:** A unit test without a browser. The rule depends on a
  container query and real focus, which need a browser. So fewer than
  three approaches exist. Since PR #249, a package test checks the focus
  return without a browser. It does not render the host slots, and it has
  no CSS or container layout to show the control.
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
