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

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6127).
