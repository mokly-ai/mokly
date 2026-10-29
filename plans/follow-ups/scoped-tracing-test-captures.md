# Make tracing captures safe in parallel tests

- **Severity:** Medium. **Effort:** Medium.
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

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6531).
