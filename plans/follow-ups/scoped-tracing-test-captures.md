# Make tracing captures safe in parallel tests

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 196 (Medium, test; open):
`crates/mokly-cli/src/_tests_/serve_trace_tests.rs` and
`crates/mokly-graph/tests/routing_work_tests.rs` capture spans with
scoped subscribers, as the sidecar trace capture did before the fix of
user item 193. A span can then be lost while parallel tests register
and drop their subscribers. Options (estimate): A install the same
once-per-process interest guard in both captures (Small); B leave
them until one of them flakes. Recommended: A, in a separate branch.

## Decision

- **Source:** Review.
- **Category:** test.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly make tracing captures safe in parallel tests?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** A.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6531).
