# Show the install-scripts hint for render failures

- **Severity:** Medium. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 152 (135 B review finding 44, wider part): the
scripts hint misses render failures. Severity Medium, effort Large.
Options: B, show the hint where changes are classified, effort not
recorded; C, a typed field and one helper, Large. Recommended: C.
Option A is an auto-fix in progress.

## Decision

- **Source:** Review.
- **Category:** product bug.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly show the install-scripts hint for render failures?
- **Options:**
  - **B.** Use option B from the Task section. Effort: Medium.
  - **C.** Use option C from the Task section. Effort: Large.
- **Left out:** Option A was the direct fix in progress. This item keeps only its wider delivery choices.
- **Wider fix:** C.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** C. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6127).
