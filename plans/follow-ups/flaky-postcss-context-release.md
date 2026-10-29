# Stabilize the PostCSS context release test

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #225 and its completed plan.
- **Location:** `crates/mokly-render/tests/integration/watch_lifetimes_tests.rs`.
- **Reason:** The review or plan deferred this work until after PR #225.

The changed-class-maps test timed out once on Windows while it waited for `PostcssStop`. Later full runs passed. The suspected source is asynchronous Node context release on a busy runner.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L399).
