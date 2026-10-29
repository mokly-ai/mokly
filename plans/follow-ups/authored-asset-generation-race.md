# Keep authored assets available across generations

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #222 and its completed plan.
- **Location:** `crates/mokly-server`.
- **Reason:** The review or plan deferred this work until after PR #222.

A page can request an authored asset while a new generation publishes and receive a 404 until a render of that generation reaches the asset.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L485).
