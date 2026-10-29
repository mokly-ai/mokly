# Test selected comparison expiry without a server clock

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `docs/protocol/mokly-selected-comparisons.md` and Serve tests.
- **Reason:** The review found this problem outside the change that it reviewed.

The verification text asks tests to advance the server clock, but Serve has no clock test hook. Define a deterministic proof.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4910).
