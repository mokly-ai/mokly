# Coalesce concurrent composition of one document key

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #225 and its completed plan.
- **Location:** Render graph document composition.
- **Reason:** The review or plan deferred this work until after PR #225.

Concurrent work can compose the same document key. Coalesce the work by document key.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L100).
