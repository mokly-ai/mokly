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

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6231).
