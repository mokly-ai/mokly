# Share an opaque-asset spool for each generation

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Share one verified opaque-asset spool for each Serve generation and
route, released with its generation, under the M14 Serve budgets (M14
review 6, finding 5, option B; user decision 61, 2026-10-20).

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5426).
