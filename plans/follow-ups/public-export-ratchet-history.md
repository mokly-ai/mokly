# Repair the public-export ratchet history

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #222 and its completed plan.
- **Location:** `scripts/verification/ratchets/public-exports.mjs`, its tests, and the upgrade guide.
- **Reason:** The review or plan deferred this work until after PR #222.

The ratchet failed because the upgrade guide did not name exports removed since the recorded release tags.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L431).
