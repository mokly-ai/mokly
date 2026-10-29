# Share the base conversion batch byte limit

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #236 and its completed plan.
- **Location:** `crates/mokly-git/src/extraction.rs` and `crates/mokly-compare/src/git_prefetch.rs`.
- **Reason:** The review or plan deferred this work until after PR #236.

The two modules repeat the 48 MiB batch bound as literals. Give them one source.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/batched-base-reads.md?plain=1#L392).
