# Recover from native watch event loss

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 134 (M11 plan TODO): event-loss recovery for macOS
and Windows watches. Native watchers can drop events: macOS FSEvents
batches, and Windows buffer overflows. Do the work after the first
hosted macOS and Windows runs, with tests. The hosted native jobs do
not pass yet, so no measurement exists. Severity Medium, effort Medium
(estimate). Options: A, a repository-root rescan after each macOS
batch and an exact-input stamp check on Windows, Medium (estimate);
B, one recursive watch per root on both systems, effort not recorded.
Recommended: A (estimate). This TODO replaces the M11 TODO "After the
first hosted macOS and Windows runs, make event loss recoverable
there", which held the same choice.

## Decision

- **Source:** Design.
- **Category:** product bug.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly recover from native watch event loss?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Medium.
  - **B.** Use option B from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** A.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6078).
