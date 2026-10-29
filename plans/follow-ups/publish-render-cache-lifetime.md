# Decide the publish render-cache lifetime

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #222 and its completed plan.
- **Location:** `crates/mokly-cli` publication output.
- **Reason:** The review or plan deferred this work until after PR #222.

`publish` keeps the render cache alive through upload because its output owns the cache. Measure the cost and decide whether to release it earlier.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L421).
