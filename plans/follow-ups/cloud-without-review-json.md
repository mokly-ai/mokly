# Deploy Mokly Cloud without review.json

- **Severity:** High. **Effort:** Medium.
- **Kind:** Post-merge task.
- **Added:** 2026-10-29, from PR #217 and its completed plan.
- **Location:** The Mokly Cloud receiver.
- **Reason:** The review or plan deferred this work until after PR #217.

Pin the release, regenerate the contract fixtures, and deploy the receiver change that no longer reads `review.json`.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/remove-review-json.md?plain=1#L238).
