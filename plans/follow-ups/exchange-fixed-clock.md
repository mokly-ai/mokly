# Use the fixed clock in exchange integration tests

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #221 and its completed plan.
- **Location:** `crates/mokly-publish/tests/exchange_tests.rs` and its support module.
- **Reason:** The review or plan deferred this work until after PR #221.

Give the exchange integration tests the same fixed clock as the other exchange tests. No exchange integration test must depend on the real date.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L378).
