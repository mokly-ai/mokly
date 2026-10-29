# Name the failed path in batch conversion errors

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #236 and its completed plan.
- **Location:** `crates/mokly-git/src/checkout.rs`.
- **Reason:** The review or plan deferred this work until after PR #236.

A failed conversion batch reports the first path in the call instead of the path that failed. Preserve the file-specific error path.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/batched-base-reads.md?plain=1#L396).
