# Store the install-scripts mode in one place

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 155 (135 B review finding 51): the scripts mode is
stored in several places. Severity Low. Recommended: B, keep the mode
on the install command. The 135 B review record holds the other
options.

## Decision

- **Source:** Review.
- **Category:** code structure.
- **Background:** The base dependency path stores the lifecycle-scripts mode in several values.
- **Problem:** Repeated state can disagree as the install request moves between layers.
- **Impact if no action:** A later change can apply the wrong mode in one path.
- **Root question:** How should Mokly store the install-scripts mode in one place?
- **Options:**
  - **A.** Keep the repeated mode fields. Effort: Small.
  - **B.** Store the mode on the install command and derive each use from it. Effort: Medium.
- **Left out:** A new shared global would hide request-specific state and is worse than option B.
- **Wider fix:** B.
- **Previous examples:** The 135 B review found this repeated state.
- **Recommendation:** B. One request-owned value removes disagreement.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6145).
