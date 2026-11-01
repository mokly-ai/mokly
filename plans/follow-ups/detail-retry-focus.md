# Move focus after a detail retry

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 160, from finding 1 of the W2 review.
- **Location:** `packages/viewer/src/shell/workspace_props.tsx:148-154` and
  `packages/viewer/src/shell/workspace_usage.tsx:41-53`.
- **Reason:** Option B differs from the stated focus rule of the Props retry,
  and no rule states the focus of the Usage retry.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Detail:** the per-entry data file that the viewer loads for the Props
    and Usage panels of a component.
- **Background:**
  - When a detail fails to load, the Props and Usage panels show an error
    and a Try again button. The label is `CONTROLS_COPY.retry` in
    `packages/viewer/src/shell/component_controls_copy.ts:46`.
  - Activating Try again replaces the error with the loading state, for
    example "Loading usage…" with `role="status"` in
    `workspace_usage.tsx:53`. The button that held focus is removed.
  - The live-editing retry of `component_controls_panel.tsx:145` already
    moves focus to its preparing notice through `FocusAfter`, at
    `component_controls.tsx:245-251`. The Props and Usage detail-load
    retries move no focus. The Usage button text is the literal
    "Try again", at `workspace_usage.tsx:49`.
- **Problem:** After Try again in the Props or Usage panel, focus falls back
  to the page instead of the new loading state or the restored panel.
- **Impact if no action:** Keyboard and screen-reader users lose their place
  during recovery.
- **Root question:** Where should focus go when a detail panel recovers from
  a failed load?
- **Options:**
  - **A.** Document that a detail retry keeps the browser's focus. Effort:
    Small.
  - **B.** Move focus to the loading status, then to the restored panel
    heading. Effort: Medium.
- **Left out:** Move focus only after success. The loading transition then
  stays unannounced. Fewer than three approaches exist, because focus
  either moves with the state or stays where the browser puts it.
- **Wider fix:** B. One recovery focus sequence covers every detail panel.
  `FocusAfter` in `packages/viewer/src/shell/focus_after.ts` already gives
  the live-editing retry such a sequence.
- **Previous examples:** None found.
- **Recommendation:** B. It gives recovery a predictable focus destination.
- **Action:** ask the user, because B moves focus to the loading status first,
  but `docs/protocol/mokly-component-controls-design.md:69-70` sends it to the
  panel heading after Try again.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6183).
