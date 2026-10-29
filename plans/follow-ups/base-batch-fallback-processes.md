# Avoid one Git process per failed-batch file

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #236 and its completed plan.
- **Location:** `crates/mokly-git/src/extraction.rs` and `crates/mokly-compare/src/git_prefetch.rs`.
- **Reason:** The review or plan deferred this work until after PR #236.

A failed batch converts each file in its own call. Each file can start about three Git processes. Batch the fallback without losing the file-specific failure.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/batched-base-reads.md?plain=1#L389).
