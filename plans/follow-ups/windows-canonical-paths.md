# Use Node-compatible canonical paths on Windows

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 166 (native CI round 6): product code can still call
`std::fs::canonicalize`, which returns the `\\?\` form on Windows that
npm and Node reject: `crates/mokly-git/src/disk.rs:42` and
`crates/mokly-sidecar/src/memory_table.rs:67`. Neither reaches Node
now. Severity Low, effort not recorded. Options: A, keep the two calls;
B, use `dunce::canonicalize` there and forbid `std::fs::canonicalize`
in product code with a Clippy `disallowed-methods` rule (a new lint,
which needs the user's approval). Recommended: B.

## Decision

- **Source:** Review.
- **Category:** product bug.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly use Node-compatible canonical paths on Windows?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6231).
