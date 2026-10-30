# Use the fixed clock in exchange integration tests

- **Severity:** Low (estimate). **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #221 and its completed plan, the wider fix
  that its first review split off finding 1.
- **Location:** `crates/mokly-publish/tests/exchange_tests.rs:135` and line
  186, `crates/mokly-publish/tests/gzip_upload_tests.rs:27`, and
  `crates/mokly-publish/tests/support/mod.rs:1`.
- **Reason:** The review split this test-design change off a fixed finding
  of PR #221, and no dated user choice approves it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Exchange integration tests:** the tests in
    `crates/mokly-publish/tests/` that run the upload exchange of
    `mokly publish` against a local test server.
  - **Upload expiry:** the `upload.expiresAt` time of a Plan response. The
    CLI checks it against its clock.
- **Background:**
  - `crates/mokly-publish/tests/gzip_upload_tests.rs:27` defines a
    `FixedClock`. Its `now` returns `1_800_000_000_000`, its `jitter`
    returns 0, and its `sleep` returns at once.
  - `crates/mokly-publish/tests/exchange_tests.rs:135` and line 186 give the
    exchange `SystemClock`, the real clock.
  - So the Plan answers of `exchange_tests.rs` set the fixed expiry
    `2099-01-01T00:00:00.000Z`, at line 93, to stay in the future.
  - The shared test support lives in `crates/mokly-publish/tests/support/`.
  - The `deterministic-tests` skill bars real clocks in unit tests. It lets
    integration tests use real implementations for end-to-end behaviour, so
    the real clock of these integration tests is allowed.
  - A finding of the first review of PR #221 was fixed in that pull
    request. Its text was not kept in the repository. The review then split
    off this wider fix, so that no exchange integration test depends on the
    real date.
- **Problem:** The exchange integration tests still read the real date. Their
  fixed expiry turns into a past date after 2099-01-01. The choice is
  between independence from the date of the run and the existing 2099
  expiry, which works today.
- **Impact if no action:** The tests keep working until 2099-01-01. A later
  test that copies this setup can pick an expiry that passes sooner, and
  then fail on a correct change.
- **Root question:** How do the exchange integration tests stay valid,
  whatever the date of the run?
- **Options:**
  - **A.** Move the `FixedClock` into `crates/mokly-publish/tests/support/`.
    Use it in `exchange_tests.rs` and `gzip_upload_tests.rs`, and give the
    Plan answers expiries relative to the fixed time. Effort: Medium.
  - **B.** Change nothing, and keep the 2099 expiry. Effort: Small
    (estimate).
  - **C.** Add a fixed clock to the library's test support, so that every
    integration test of `mokly-publish` can import it. Effort: Medium
    (estimate).
- **Left out:** A lint against `SystemClock` in tests. The
  `deterministic-tests` skill allows the real clock in integration tests,
  and a new lint needs the user.
- **Wider fix:** A. One shared clock in the test support removes the real
  date from every exchange integration test.
- **Previous examples:** `crates/mokly-publish/tests/exchange_tests.rs` uses
  `SystemClock` with the fixed expiry 2099-01-01, as the review of PR #221
  recorded.
- **Recommendation:** A. It makes the tests independent of the date of the
  run, with the clock that the gzip tests already use. B stays valid,
  because the skill allows the real clock here and the 2099 expiry holds for
  decades.
- **Action:** ask the user, because condition 6 holds (estimate): the item is
  a test-design change that a review split off, and no dated user choice
  approves it.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/gzip-blob-uploads.md?plain=1#L378).
