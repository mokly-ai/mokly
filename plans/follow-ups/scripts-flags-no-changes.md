# Document scripts flags with no Changes build

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 157 (135 B review finding 53): the scripts flags
are ignored with `--no-changes`. Severity Low. Recommended: A,
document it. The 135 B review record holds the other options.

## Decision

- **Source:** Review.
- **Category:** docs or spec.
- **Background:** Base install script flags affect comparison preparation. `--no-changes` disables that preparation.
- **Problem:** Mokly accepts the flags with `--no-changes` and silently ignores them.
- **Impact if no action:** A command can appear to use a script policy that has no effect.
- **Root question:** How should Mokly document scripts flags with no Changes build?
- **Options:**
  - **A.** Document that the flags have no effect with `--no-changes`. Effort: Small.
  - **B.** Reject the unused combination with a CLI error. This adds stricter validation. Effort: Small.
- **Left out:** Applying the flags is impossible because no base dependency installation runs.
- **Wider fix:** None. The existing repository rules already cover this class.
- **Previous examples:** The 135 B review found the ignored flags.
- **Recommendation:** A. It states the existing behavior without adding a new rejection.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6154).
