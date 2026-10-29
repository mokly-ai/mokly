# Keep head render entries while the base renders

- **Severity:** Medium. **Effort:** Large.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #222 and its completed plan.
- **Location:** The render cache used by Changes.
- **Reason:** The review or plan deferred this work until after PR #222.

Keep head entries in the cache during base rendering so comparison does not render head documents again. Decision D2 still left 640 to 740 evictions on `examples/basic`.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L492).
