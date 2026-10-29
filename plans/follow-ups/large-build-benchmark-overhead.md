# Explain the large build benchmark overhead

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #220 and its completed plan.
- **Location:** `scripts/large/`.
- **Reason:** The review or plan deferred this work until after PR #220.

The old binary took 2.3 times longer through the benchmark harness than in a direct run. Find the source of the harness overhead.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/build-head-capture.md?plain=1#L209).
