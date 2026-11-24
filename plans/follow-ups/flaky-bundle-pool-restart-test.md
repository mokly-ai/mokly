# Flaky bundle pool restart test on macOS

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-23, from CI run 45161173462 of the branch
  `conductor/storybook-support-j-spike-for-decision-18`, pull request #349.
- **Location:** `crates/mokly-compare/tests/bundle_pool_tests.rs:162-215`:
  the test. Line 209 holds the assertion that failed.
- **Reason:** The test fails now and then on branches that do not touch it,
  so one fix in its own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - The Rust test `restarted_disk_recipes_reject_an_added_earlier_absolute_paths_target`
    in `crates/mokly-compare` bundles a fixture with a first bundle pool,
    shuts that pool down, and starts a second pool on the same disk cache.
    Line 209 expects the second pool to find the first pool's record:
    `assert_eq!(unchanged.cache, Some(CacheOutcome::Hit))`.
  - It runs in the `Native (macos-26)` job of CI, through
    `cargo test --locked -p "mokly-*" -p xtask --no-fail-fast`.
  - On 2026-11-23, it failed in CI run 45161173462, attempt 1, at line 209,
    with `assertion left == right failed`, `left: Some(NoRecord)`, and
    `right: Some(Hit)`.
  - The same job passed on the rerun, attempt 2, of the same commit. It
    also passed on the commit before, which had the same code. That branch
    did not touch `crates/mokly-compare`.
  - Suspected source: timing. The second pool found no record that the
    first pool should have stored. Either the first pool stored no record,
    for example because its capture ran too close to the fixture's file
    writes, or the record was not visible when the second pool started.
- **Problem:** The test depends on a disk cache record that the first pool
  does not always leave for the second pool.
- **Impact if no action:** The `Native (macos-26)` job fails now and then on
  unrelated branches, and each failure costs a rerun.
- **Root question:** How does the test prove that a restarted pool reuses
  the stored record, without a timing window?
- **Options:**
  - **A.** Reproduce the failure on macOS, name the step that leaves no
    record, and give the test an explicit signal that the record is
    stored. Keep every assertion. Effort: Medium.
  - **B.** Make the first pool's shutdown wait until its record is stored,
    when the product needs that guarantee too. Effort: Medium.
- **Left out:** A retry or a longer wait: both hide the cause.
- **Wider fix:** None, because the cause is not known yet.
- **Previous examples:** None found.
- **Recommendation:** A. It names the cause first, and B can follow when the
  product needs the guarantee.
- **Action:** fix after merge, apply A, because the test is outside the
  diff of the branch that found it.
