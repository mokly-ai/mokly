# Large React watch journey timed out once

- **Severity:** Low. **Effort:** Medium (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #217 (`calummoore/reviewjson-purpose`).
- **Location:** `tests/browser/large_watch.spec.ts`, the test "large watch
  delivers browser evidence for react", and `scripts/large/delivery.ts:75`.
- **Reason:** The test failed in a step that PR #217 did not change, and it
  passed on the rerun.

The test failed once in browser shard 1 of 4 of the remote gate run
20261026T221539Z-992801 with `Test timeout of 300000ms exceeded` and
`page.waitForFunction: Test ended`. It waited at `scripts/large/delivery.ts:75`
for the first publication after a watched edit. It passed on a local rerun and
in three other gate runs. The suspected source is the React large-fixture watch
rebuild on a busy remote box, which can pass the 300-second test timeout. User
decision 105 of the Rust rebuild accepts rare timeouts of this journey.
