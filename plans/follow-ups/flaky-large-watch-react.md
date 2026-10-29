# Stabilize the large React watch test

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 and its completed plan.
- **Location:** `tests/browser/large_watch.spec.ts`.
- **Reason:** The review or plan deferred this work until after PR #217.

The React journey timed out in remote browser runs and passed on rerun and on later main runs. Several completed plans observed this test. Diagnose the event or readiness race instead of increasing elapsed-time assertions.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L185).
