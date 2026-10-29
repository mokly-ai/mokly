# Move focus after a detail retry

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `packages/viewer/src/shell/component_controls_copy.ts` and `packages/viewer/src/shell/workspace_usage.tsx`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** The Props and Usage panels show a Try again action after a detail load fails.
- **Problem:** Activating Try again leaves focus on the page instead of the new loading state or restored panel.
- **Impact if no action:** Keyboard and screen-reader users lose their place during recovery.
- **Root question:** How should Mokly move focus after a detail retry?
- **Options:**
  - **A.** Document that retry keeps browser focus. Effort: Small.
  - **B.** Move focus to the loading status and then to the restored panel heading. Effort: Medium.
- **Left out:** Moving focus only after success leaves the loading transition unannounced.
- **Wider fix:** B. One recovery focus sequence covers every detail panel.
- **Previous examples:** W2 finding 1 recorded the Props and Usage cases.
- **Recommendation:** B. It gives recovery a predictable focus destination.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6183).
